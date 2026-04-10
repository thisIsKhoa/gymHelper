import { prisma } from '../../db/prisma.js';
import { cacheNamespaces, readThroughCache, serializeCacheKey } from '../../utils/cache.js';

const PROGRESS_EXERCISE_TTL_MS = 300_000;
const PROGRESS_OVERVIEW_TTL_MS = 180_000;

function weekKey(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function weeksAgoDate(weeks: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - weeks * 7);
  return date;
}

export async function getExerciseProgressByWeek(userId: string, exerciseName: string, weeks: number) {
  const normalizedExerciseName = exerciseName.trim();

  return readThroughCache(
    cacheNamespaces.progressExercise,
    serializeCacheKey([userId, normalizedExerciseName.toLowerCase(), weeks]),
    PROGRESS_EXERCISE_TTL_MS,
    async () => {
      const fromDate = weeksAgoDate(weeks);

      const rows = await prisma.$queryRaw<
        Array<{
          week_start: Date;
          total_weighted_kg: number | null;
          total_sets: number | bigint | null;
          max_weight_kg: number | null;
          total_volume: number | null;
          max_estimated_1rm: number | null;
        }>
      >`
        WITH filtered_sessions AS (
          SELECT
            ws."id",
            ws."sessionDate"
          FROM "WorkoutSession" AS ws
          WHERE ws."userId" = ${userId}
            AND ws."sessionDate" >= ${fromDate}
        )
        SELECT
          date_trunc('week', fs."sessionDate") AS week_start,
          SUM(COALESCE(we."weightKg", 0) * we."sets") AS total_weighted_kg,
          SUM(we."sets") AS total_sets,
          MAX(COALESCE(we."weightKg", 0)) AS max_weight_kg,
          SUM(COALESCE(we."volume", 0)) AS total_volume,
          MAX(COALESCE(we."estimated1Rm", 0)) AS max_estimated_1rm
        FROM "WorkoutEntry" AS we
        INNER JOIN filtered_sessions AS fs ON fs."id" = we."sessionId"
        WHERE we."exerciseName" = ${normalizedExerciseName}
        GROUP BY week_start
        ORDER BY week_start ASC
      `;

      const points = rows.map((row) => {
        const totalSets = Number(row.total_sets ?? 0);
        const totalWeightedKg = Number(row.total_weighted_kg ?? 0);

        return {
          week: weekKey(new Date(row.week_start)),
          avgWeightKg: totalSets > 0 ? Number((totalWeightedKg / totalSets).toFixed(2)) : 0,
          maxWeightKg: Number((row.max_weight_kg ?? 0).toFixed(2)),
          totalVolume: Number((row.total_volume ?? 0).toFixed(2)),
          maxEstimated1Rm: Number((row.max_estimated_1rm ?? 0).toFixed(2)),
        };
      });

      return {
        exerciseName: normalizedExerciseName,
        points,
      };
    },
  );
}

export async function getProgressOverview(userId: string) {
  return readThroughCache(
    cacheNamespaces.progressOverview,
    serializeCacheKey([userId]),
    PROGRESS_OVERVIEW_TTL_MS,
    async () => {
      const [bench, prs] = await Promise.all([
        getExerciseProgressByWeek(userId, 'Bench Press', 16),
        prisma.personalRecord.findMany({
          where: { userId },
          select: {
            exerciseName: true,
            bestWeightKg: true,
            bestVolume: true,
            achievedAt: true,
          },
          orderBy: [{ bestWeightKg: 'desc' }, { bestVolume: 'desc' }],
        }),
      ]);

      return {
        benchProgressByWeek: bench.points,
        personalRecords: prs,
      };
    },
  );
}
