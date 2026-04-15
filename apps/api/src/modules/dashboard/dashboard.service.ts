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

function dateOnlyKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function calculateStreakDays(sessionDatesDesc: Date[]): number {
  const unique = Array.from(new Set(sessionDatesDesc.map((date) => dateOnlyKey(date))));
  if (unique.length === 0) {
    return 0;
  }

  let streak = 1;
  for (let index = 1; index < unique.length; index += 1) {
    const prev = new Date(unique[index - 1] as string);
    const current = new Date(unique[index] as string);
    const diffDays = Math.round((prev.getTime() - current.getTime()) / 86400000);

    if (diffDays === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
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

      const [volumeRows, streakSessions, prs, latestBodyMetric, weeklyStatsDesc, strengthRows, benchRows, unlockedAchievements, muscleSkillRadar] =
        await Promise.all([
          prisma.$queryRaw<
            Array<{
              session_date: Date;
              total_volume: number | null;
            }>
          >`
            SELECT
              ws."sessionDate" AS session_date,
              SUM(ws."totalVolume") AS total_volume
            FROM "WorkoutSession" AS ws
            WHERE ws."userId" = ${userId}
              AND ws."sessionDate" >= ${fromDate}
            GROUP BY ws."sessionDate"
            ORDER BY ws."sessionDate" ASC
          `,
          prisma.workoutSession.findMany({
            where: { userId },
            select: {
              sessionDate: true,
            },
            orderBy: {
              sessionDate: 'desc',
            },
            take: 180,
          }),
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
          prisma.$queryRaw<
            Array<{
              week_start: Date;
              max_weight_kg: number | null;
            }>
          >`
            WITH user_sessions AS (
              SELECT
                ws."id",
                ws."sessionDate"
              FROM "WorkoutSession" AS ws
              WHERE ws."userId" = ${userId}
                AND ws."sessionDate" >= ${fromDate}
            )
            SELECT
              date_trunc('week', us."sessionDate") AS week_start,
              MAX(we."weightKg") AS max_weight_kg
            FROM "WorkoutEntry" AS we
            INNER JOIN user_sessions AS us ON us."id" = we."sessionId"
            WHERE we."weightKg" IS NOT NULL
              AND we."exerciseName" IN ('Bench Press', 'bench press')
            GROUP BY week_start
            ORDER BY week_start ASC
          `,
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
      const streakDays = calculateStreakDays(streakSessions.map((session) => session.sessionDate));

      const volumeTrend = volumeRows.map((row) => ({
        date: row.session_date.toISOString().slice(0, 10),
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
          week: weekKey(new Date(row.week_start)),
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
