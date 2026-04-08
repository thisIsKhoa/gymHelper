import { prisma } from '../../db/prisma.js';

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
  const fromDate = weeksAgoDate(weeks);

  const entries = await prisma.workoutEntry.findMany({
    where: {
      exerciseName,
      session: {
        userId,
        sessionDate: {
          gte: fromDate,
        },
      },
    },
    include: {
      session: {
        select: {
          sessionDate: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const map = new Map<string, {
    totalWeight: number;
    weightedSets: number;
    maxWeightKg: number;
    totalVolume: number;
    maxEstimated1Rm: number;
  }>();

  for (const entry of entries) {
    const key = weekKey(entry.session.sessionDate);
    const current = map.get(key) ?? {
      totalWeight: 0,
      weightedSets: 0,
      maxWeightKg: 0,
      totalVolume: 0,
      maxEstimated1Rm: 0,
    };
    const weight = entry.weightKg ?? 0;

    current.totalWeight += weight;
    current.weightedSets += entry.sets;
    current.maxWeightKg = Math.max(current.maxWeightKg, weight);
    current.totalVolume += entry.volume;
    current.maxEstimated1Rm = Math.max(current.maxEstimated1Rm, entry.estimated1Rm);

    map.set(key, current);
  }

  const points = Array.from(map.entries()).map(([week, value]) => ({
    week,
    avgWeightKg: value.weightedSets > 0 ? Number((value.totalWeight / value.weightedSets).toFixed(2)) : 0,
    maxWeightKg: Number(value.maxWeightKg.toFixed(2)),
    totalVolume: Number(value.totalVolume.toFixed(2)),
    maxEstimated1Rm: Number(value.maxEstimated1Rm.toFixed(2)),
  }));

  return {
    exerciseName,
    points,
  };
}

export async function getProgressOverview(userId: string) {
  const [bench, prs] = await Promise.all([
    getExerciseProgressByWeek(userId, 'Bench Press', 16),
    prisma.personalRecord.findMany({
      where: { userId },
      orderBy: [{ bestWeightKg: 'desc' }, { bestVolume: 'desc' }],
    }),
  ]);

  return {
    benchProgressByWeek: bench.points,
    personalRecords: prs,
  };
}
