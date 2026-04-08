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

export async function getDashboardOverview(userId: string) {
  const [sessions, prs, entries, latestBodyMetric, weeklyStatsDesc] = await Promise.all([
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
    prisma.weeklyWorkoutStat.findMany({
      where: { userId },
      orderBy: { isoWeek: 'desc' },
      take: 12,
    }),
  ]);
  const weeklyStats = [...weeklyStatsDesc].reverse();

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

  const currentWeek = weekKey(new Date());
  const currentWeekStat = weeklyStats.find((item) => item.isoWeek === currentWeek);
  const streakDays = calculateStreakDays(
    [...sessions]
      .sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime())
      .map((session) => session.sessionDate),
  );

  return {
    volumeTrend: Array.from(volumeMap.entries()).map(([date, volume]) => ({ date, volume })),
    workoutFrequency: Array.from(frequencyMap.entries()).map(([week, sessionsCount]) => ({ week, sessionsCount })),
    weeklySummary: weeklyStats.map((week) => ({
      week: week.isoWeek,
      totalVolume: Number(week.totalVolume.toFixed(2)),
      sessionsCount: week.sessionsCount,
      strongestLiftKg: Number(week.strongestLiftKg.toFixed(2)),
    })),
    benchProgressByWeek: Array.from(benchByWeek.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, maxWeightKg]) => ({ week, maxWeightKg })),
    strengthIncrease,
    prHighlights: prs,
    latestBodyMetric,
    thisWeek: {
      week: currentWeek,
      totalVolume: Number((currentWeekStat?.totalVolume ?? 0).toFixed(2)),
      sessionsCount: currentWeekStat?.sessionsCount ?? 0,
      strongestLiftKg: Number((currentWeekStat?.strongestLiftKg ?? 0).toFixed(2)),
      streakDays,
    },
  };
}
