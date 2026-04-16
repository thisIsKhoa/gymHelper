import { prisma } from '../../db/prisma.js';
import { ACHIEVEMENT_DEFINITIONS } from '../gamification/gamification.constants.js';
import { cacheNamespaces, readThroughCache, serializeCacheKey } from '../../utils/cache.js';

const DASHBOARD_OVERVIEW_TTL_MS = 180_000;
const DASHBOARD_OVERVIEW_DEFAULT_WEEKS = 16;
const DASHBOARD_OVERVIEW_MIN_WEEKS = 4;
const DASHBOARD_OVERVIEW_MAX_WEEKS = 52;

function clampWeeks(weeks: number): number {
  return Math.max(DASHBOARD_OVERVIEW_MIN_WEEKS, Math.min(DASHBOARD_OVERVIEW_MAX_WEEKS, Math.round(weeks)));
}

function weeksAgoDate(weeks: number): Date {
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - weeks * 7);
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
}

async function queryStrengthIncreaseRows(userId: string) {
  return prisma.$queryRaw<
    Array<{
      exercise_name: string;
      start_weight_kg: number | null;
      current_weight_kg: number | null;
    }>
  >`
    SELECT
      ues."exerciseName" AS exercise_name,
      ues."firstWeightKg" AS start_weight_kg,
      ues."latestWeightKg" AS current_weight_kg
    FROM "UserExerciseStat" AS ues
    WHERE ues."userId" = ${userId}
      AND ues."entryCount" >= 2
    ORDER BY (ues."latestWeightKg" - ues."firstWeightKg") DESC
    LIMIT 10
  `;
}

function weekKey(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ── Q1: Merged volume-trend + bench-progress CTE ──────────────────────
// Computes both aggregations in a single round-trip by sharing a
// `user_sessions` CTE and returning tagged UNION ALL rows.

type VolumeOrBenchRow = {
  source: string;
  session_date: Date | null;
  total_volume: number | null;
  week_start: Date | null;
  max_weight_kg: number | null;
};

async function queryVolumeTrendAndBenchProgress(userId: string, fromDate: Date) {
  return prisma.$queryRaw<VolumeOrBenchRow[]>`
    WITH user_sessions AS (
      SELECT ws."id", ws."sessionDate", ws."totalVolume"
      FROM "WorkoutSession" AS ws
      WHERE ws."userId" = ${userId}
        AND ws."sessionDate" >= ${fromDate}
    ),
    volume_trend AS (
      SELECT
        us."sessionDate"  AS session_date,
        SUM(us."totalVolume")::double precision AS total_volume
      FROM user_sessions AS us
      GROUP BY us."sessionDate"
    ),
    bench_weekly AS (
      SELECT
        date_trunc('week', us."sessionDate") AS week_start,
        MAX(we."weightKg")::double precision  AS max_weight_kg
      FROM "WorkoutEntry" AS we
      INNER JOIN user_sessions AS us ON us."id" = we."sessionId"
      WHERE we."weightKg" IS NOT NULL
        AND LOWER(we."exerciseName") = 'bench press'
      GROUP BY week_start
    )
    SELECT
      'volume'  AS source,
      vt.session_date,
      vt.total_volume,
      NULL::timestamptz AS week_start,
      NULL::double precision AS max_weight_kg
    FROM volume_trend AS vt

    UNION ALL

    SELECT
      'bench'  AS source,
      NULL::date        AS session_date,
      NULL::double precision AS total_volume,
      bw.week_start,
      bw.max_weight_kg
    FROM bench_weekly AS bw

    ORDER BY source ASC, session_date ASC, week_start ASC
  `;
}

// ── Q4: Window-function streak computation ────────────────────────────
// Calculates the current consecutive-day workout streak entirely in SQL
// instead of transferring 180 rows to JS.

async function queryStreakDays(userId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ streak_days: number }>>`
    WITH ordered AS (
      SELECT DISTINCT "sessionDate"::date AS d
      FROM "WorkoutSession"
      WHERE "userId" = ${userId}
      ORDER BY d DESC
    ),
    gaps AS (
      SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d DESC))::int AS grp
      FROM ordered
    )
    SELECT COUNT(*)::int AS streak_days
    FROM gaps
    WHERE grp = (SELECT grp FROM gaps LIMIT 1)
  `;

  return rows[0]?.streak_days ?? 0;
}

export async function getDashboardOverview(
  userId: string,
  weeks: number = DASHBOARD_OVERVIEW_DEFAULT_WEEKS,
) {
  const effectiveWeeks = clampWeeks(weeks);
  const fromDate = weeksAgoDate(effectiveWeeks);

  return readThroughCache(
    cacheNamespaces.dashboardOverview,
    serializeCacheKey([userId, effectiveWeeks]),
    DASHBOARD_OVERVIEW_TTL_MS,
    async () => {
      const achievementByCode = new Map(
        ACHIEVEMENT_DEFINITIONS.map((achievement) => [achievement.code, achievement]),
      );

      const [volumeBenchRows, streakDays, prs, latestBodyMetric, weeklyStatsDesc, strengthRows, unlockedAchievements, muscleSkillRadar] =
        await Promise.all([
          // Q1: Single CTE for volume trend + bench progress
          queryVolumeTrendAndBenchProgress(userId, fromDate),
          // Q4: SQL-computed streak
          queryStreakDays(userId),
          prisma.personalRecord.findMany({
            where: { userId },
            select: {
              exerciseName: true,
              bestWeightKg: true,
              bestVolume: true,
              achievedAt: true,
            },
            orderBy: {
              updatedAt: 'desc',
            },
            take: 5,
          }),
          prisma.bodyMetric.findFirst({
            where: { userId },
            select: {
              weightKg: true,
              bodyFatPct: true,
              muscleMassKg: true,
            },
            orderBy: {
              loggedAt: 'desc',
            },
          }),
          prisma.weeklyWorkoutStat.findMany({
            where: { userId },
            select: {
              isoWeek: true,
              totalVolume: true,
              sessionsCount: true,
              strongestLiftKg: true,
            },
            orderBy: { isoWeek: 'desc' },
            take: effectiveWeeks,
          }),
          queryStrengthIncreaseRows(userId),
          prisma.userAchievement.findMany({
            where: {
              userId,
              isUnlocked: true,
            },
            select: {
              code: true,
              unlockedAt: true,
              updatedAt: true,
            },
            orderBy: [{ unlockedAt: 'desc' }, { updatedAt: 'desc' }],
            take: 8,
          }),
          prisma.muscleSkillProgress.findMany({
            where: { userId },
            select: {
              skill: true,
              level: true,
              totalExp: true,
            },
            orderBy: {
              skill: 'asc',
            },
          }),
        ]);
      const weeklyStats = [...weeklyStatsDesc].reverse();

      // ── Split the merged CTE result into volume + bench rows ──
      const volumeRows = volumeBenchRows.filter((row) => row.source === 'volume');
      const benchRows = volumeBenchRows.filter((row) => row.source === 'bench');

      const strengthIncrease = strengthRows.map((row) => {
        const startWeightKg = Number((row.start_weight_kg ?? 0).toFixed(2));
        const currentWeightKg = Number((row.current_weight_kg ?? 0).toFixed(2));

        return {
          exerciseName: row.exercise_name,
          startWeightKg,
          currentWeightKg,
          deltaKg: Number((currentWeightKg - startWeightKg).toFixed(2)),
        };
      });

      const currentWeek = weekKey(new Date());
      const currentWeekStat = weeklyStats.find((item) => item.isoWeek === currentWeek);

      const volumeTrend = volumeRows.map((row) => ({
        date: row.session_date!.toISOString().slice(0, 10),
        volume: Number((row.total_volume ?? 0).toFixed(2)),
      }));

      const completedAchievements = unlockedAchievements.map((achievement) => {
        const definition = achievementByCode.get(achievement.code);

        return {
          code: achievement.code,
          title: definition?.title ?? String(achievement.code),
          description: definition?.description ?? 'Achievement unlocked.',
          iconKey: definition?.iconKey ?? 'achievement',
          category: definition?.category ?? 'hidden',
          unlockedAt: achievement.unlockedAt ?? achievement.updatedAt,
        };
      });

      return {
        volumeTrend,
        workoutFrequency: weeklyStats.map((week) => ({ week: week.isoWeek, sessionsCount: week.sessionsCount })),
        weeklySummary: weeklyStats.map((week) => ({
          week: week.isoWeek,
          totalVolume: Number(week.totalVolume.toFixed(2)),
          sessionsCount: week.sessionsCount,
          strongestLiftKg: Number(week.strongestLiftKg.toFixed(2)),
        })),
        benchProgressByWeek: benchRows.map((row) => ({
          week: weekKey(new Date(row.week_start!)),
          maxWeightKg: Number((row.max_weight_kg ?? 0).toFixed(2)),
        })),
        strengthIncrease,
        prHighlights: prs,
        muscleSkillRadar: muscleSkillRadar.map((item) => ({
          skill: item.skill,
          level: item.level,
          totalExp: Number(item.totalExp.toFixed(2)),
        })),
        completedAchievements,
        latestBodyMetric,
        thisWeek: {
          week: currentWeek,
          totalVolume: Number((currentWeekStat?.totalVolume ?? 0).toFixed(2)),
          sessionsCount: currentWeekStat?.sessionsCount ?? 0,
          strongestLiftKg: Number((currentWeekStat?.strongestLiftKg ?? 0).toFixed(2)),
          streakDays,
        },
        timeframeWeeks: effectiveWeeks,
      };
    },
  );
}
