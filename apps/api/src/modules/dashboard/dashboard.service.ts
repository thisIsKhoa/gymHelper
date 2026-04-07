import { prisma } from '../../db/prisma.js';

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function weekKey(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export async function getDashboardOverview(userId: string) {
  const [sessions, prs, entries, latestBodyMetric] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { sessionDate: 'asc' },
    }),
    prisma.personalRecord.findMany({
      where: { userId },
      orderBy: [{ bestWeightKg: 'desc' }, { bestVolume: 'desc' }],
      take: 6,
    }),
    prisma.workoutEntry.findMany({
      where: {
        session: {
          userId,
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        session: {
          select: {
            sessionDate: true,
          },
        },
      },
    }),
    prisma.bodyMetric.findFirst({
      where: { userId },
      orderBy: {
        loggedAt: 'desc',
      },
    }),
  ]);

  const volumeMap = new Map<string, number>();
  for (const session of sessions) {
    const key = dateKey(session.sessionDate);
    volumeMap.set(key, (volumeMap.get(key) ?? 0) + session.totalVolume);
  }

  const frequencyMap = new Map<string, number>();
  for (const session of sessions) {
    const key = weekKey(session.sessionDate);
    frequencyMap.set(key, (frequencyMap.get(key) ?? 0) + 1);
  }

  const byExercise = new Map<string, number[]>();
  const benchByWeek = new Map<string, number>();
  for (const entry of entries) {
    const weight = entry.weightKg ?? 0;
    if (!byExercise.has(entry.exerciseName)) {
      byExercise.set(entry.exerciseName, []);
    }
    byExercise.get(entry.exerciseName)!.push(weight);

    if (entry.exerciseName.toLowerCase() === 'bench press' && weight > 0) {
      const key = weekKey(entry.session.sessionDate);
      benchByWeek.set(key, Math.max(benchByWeek.get(key) ?? 0, weight));
    }
  }

  const strengthIncrease = Array.from(byExercise.entries())
    .filter(([, weights]) => weights.length >= 2)
    .map(([exerciseName, weights]) => {
      const startWeightKg = weights[0] ?? 0;
      const currentWeightKg = weights.at(-1) ?? startWeightKg;

      return {
        exerciseName,
        startWeightKg,
        currentWeightKg,
        deltaKg: Number((currentWeightKg - startWeightKg).toFixed(2)),
      };
    })
    .sort((a, b) => b.deltaKg - a.deltaKg)
    .slice(0, 10);

  return {
    volumeTrend: Array.from(volumeMap.entries()).map(([date, volume]) => ({ date, volume })),
    workoutFrequency: Array.from(frequencyMap.entries()).map(([week, sessionsCount]) => ({ week, sessionsCount })),
    benchProgressByWeek: Array.from(benchByWeek.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, maxWeightKg]) => ({ week, maxWeightKg })),
    strengthIncrease,
    prHighlights: prs,
    latestBodyMetric,
  };
}
