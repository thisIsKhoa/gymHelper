import type { Prisma } from '@prisma/client';
import { ExerciseType } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import {
  cacheNamespaces,
  invalidateCacheKeys,
  readThroughCache,
  serializeCacheKey,
} from '../../utils/cache.js';
import { HttpError } from '../../utils/http-error.js';
import type { CreateWorkoutInput } from './workout.schemas.js';

const WORKOUT_HISTORY_TTL_MS = 180_000;
const WORKOUT_PRS_TTL_MS = 45_000;
const WORKOUT_ANALYTICS_TTL_MS = 30_000;
const WORKOUT_SUGGESTION_TTL_MS = 20_000;
const WORKOUT_HISTORY_DEFAULT_LIMIT = 30;
const COMMON_HISTORY_LIMITS: ReadonlyArray<number | null> = [null, 8];
const COMMON_PROGRESS_WEEKS: ReadonlyArray<number> = [8, 12, 16, 24];
const COMMON_ANALYTIC_WEEKS: ReadonlyArray<number> = [8, 12, 16, 24];

function calculateVolume(sets: number, reps: number, weightKg?: number): number {
  if (!weightKg) {
    return 0;
  }

  return Number((sets * reps * weightKg).toFixed(2));
}

function calculateEstimatedOneRm(weightKg?: number, reps?: number): number {
  if (!weightKg || !reps) {
    return 0;
  }

  // Epley formula: 1RM = weight * (1 + reps / 30)
  return Number((weightKg * (1 + reps / 30)).toFixed(2));
}

function toIsoWeek(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase();
}

const compoundExercises = new Set([
  'bench press',
  'incline bench press',
  'overhead press',
  'back squat',
  'front squat',
  'deadlift',
  'romanian deadlift',
  'barbell row',
  'pull up',
  'weighted pull up',
  'hip thrust',
]);

function inferExerciseType(exerciseName: string, overrideType?: ExerciseType): ExerciseType {
  if (overrideType) {
    return overrideType;
  }

  return compoundExercises.has(normalizeExerciseName(exerciseName))
    ? ExerciseType.COMPOUND
    : ExerciseType.ISOLATION;
}

function defaultRestByType(type: ExerciseType): number {
  return type === ExerciseType.COMPOUND ? 150 : 60;
}

function isBenchVariant(exerciseName: string): boolean {
  return normalizeExerciseName(exerciseName).includes('bench');
}

function benchRestSecondsByReps(reps?: number | null): number {
  if (!reps || reps <= 0) {
    return 150;
  }

  if (reps <= 5) {
    return 180;
  }

  if (reps <= 8) {
    return 150;
  }

  return 120;
}

async function upsertPersonalRecord(
  tx: Prisma.TransactionClient,
  userId: string,
  exerciseName: string,
  weightKg: number,
  volume: number,
  achievedAt: Date,
): Promise<void> {
  const current = await tx.personalRecord.findUnique({
    where: {
      userId_exerciseName: {
        userId,
        exerciseName,
      },
    },
  });

  if (!current) {
    await tx.personalRecord.create({
      data: {
        userId,
        exerciseName,
        bestWeightKg: weightKg,
        bestVolume: volume,
        achievedAt,
      },
    });
    return;
  }

  const bestWeightKg = Math.max(current.bestWeightKg, weightKg);
  const bestVolume = Math.max(current.bestVolume, volume);

  if (bestWeightKg !== current.bestWeightKg || bestVolume !== current.bestVolume) {
    await tx.personalRecord.update({
      where: { id: current.id },
      data: {
        bestWeightKg,
        bestVolume,
        achievedAt,
      },
    });
  }
}

export async function createWorkoutSession(userId: string, input: CreateWorkoutInput) {
  const session = await prisma.$transaction(async (tx) => {
    const session = await tx.workoutSession.create({
      data: {
        userId,
        sessionDate: input.sessionDate,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        notes: input.notes,
      },
    });

    let totalVolume = 0;
    let strongestLiftKg = 0;

    for (const entry of input.entries) {
      const volume = calculateVolume(entry.sets, entry.reps, entry.weightKg);
      const estimated1Rm = calculateEstimatedOneRm(entry.weightKg, entry.reps);
      totalVolume += volume;
      strongestLiftKg = Math.max(strongestLiftKg, entry.weightKg ?? 0);

      await tx.workoutEntry.create({
        data: {
          sessionId: session.id,
          exerciseName: entry.exerciseName,
          sets: entry.sets,
          reps: entry.reps,
          weightKg: entry.weightKg,
          rpe: entry.rpe,
          isCompleted: entry.isCompleted ?? true,
          durationSec: entry.durationSec,
          restSeconds: entry.restSeconds,
          volume,
          estimated1Rm,
        },
      });

      await upsertPersonalRecord(
        tx,
        userId,
        entry.exerciseName,
        entry.weightKg ?? 0,
        volume,
        input.endedAt ?? new Date(),
      );
    }

    const isoWeek = toIsoWeek(input.sessionDate);
    const existingWeekly = await tx.weeklyWorkoutStat.findUnique({
      where: {
        userId_isoWeek: {
          userId,
          isoWeek,
        },
      },
    });

    if (existingWeekly) {
      await tx.weeklyWorkoutStat.update({
        where: { id: existingWeekly.id },
        data: {
          totalVolume: Number((existingWeekly.totalVolume + totalVolume).toFixed(2)),
          sessionsCount: existingWeekly.sessionsCount + 1,
          strongestLiftKg: Math.max(existingWeekly.strongestLiftKg, strongestLiftKg),
        },
      });
    } else {
      await tx.weeklyWorkoutStat.create({
        data: {
          userId,
          isoWeek,
          totalVolume,
          sessionsCount: 1,
          strongestLiftKg,
        },
      });
    }

    return tx.workoutSession.update({
      where: { id: session.id },
      data: {
        totalVolume,
      },
      include: {
        entries: true,
      },
    });
  });

  const normalizedExerciseNames = Array.from(
    new Set(input.entries.map((entry) => normalizeExerciseName(entry.exerciseName))),
  );

  const cacheEntries: Array<{ namespace: string; key: string }> = [
    {
      namespace: cacheNamespaces.dashboardOverview,
      key: serializeCacheKey([userId]),
    },
    {
      namespace: cacheNamespaces.progressOverview,
      key: serializeCacheKey([userId]),
    },
    {
      namespace: cacheNamespaces.workoutPrs,
      key: serializeCacheKey([userId]),
    },
  ];

  for (const limit of COMMON_HISTORY_LIMITS) {
    cacheEntries.push({
      namespace: cacheNamespaces.workoutHistory,
      key: serializeCacheKey([userId, null, null, limit]),
    });
  }

  for (const weeks of COMMON_ANALYTIC_WEEKS) {
    cacheEntries.push({
      namespace: cacheNamespaces.workoutAnalytics,
      key: serializeCacheKey([userId, weeks]),
    });
  }

  for (const exerciseName of normalizedExerciseNames) {
    cacheEntries.push({
      namespace: cacheNamespaces.workoutSuggestion,
      key: serializeCacheKey([userId, exerciseName]),
    });

    for (const weeks of COMMON_PROGRESS_WEEKS) {
      cacheEntries.push({
        namespace: cacheNamespaces.progressExercise,
        key: serializeCacheKey([userId, exerciseName, weeks]),
      });
    }
  }

  invalidateCacheKeys(cacheEntries);

  return session;
}

export async function getWorkoutHistory(userId: string, from?: Date, to?: Date, limit?: number) {
  return readThroughCache(
    cacheNamespaces.workoutHistory,
    serializeCacheKey([userId, from?.toISOString() ?? null, to?.toISOString() ?? null, limit ?? null]),
    WORKOUT_HISTORY_TTL_MS,
    async () => {
      const effectiveLimit = limit ?? (from || to ? undefined : WORKOUT_HISTORY_DEFAULT_LIMIT);

      const sessionDateFilter: Prisma.DateTimeFilter = {};
      if (from) {
        sessionDateFilter.gte = from;
      }
      if (to) {
        sessionDateFilter.lte = to;
      }

      return prisma.workoutSession.findMany({
        where: {
          userId,
          ...(from || to
            ? {
                sessionDate: sessionDateFilter,
              }
            : {}),
        },
        select: {
          id: true,
          sessionDate: true,
          startedAt: true,
          endedAt: true,
          notes: true,
          totalVolume: true,
          entries: {
            select: {
              exerciseName: true,
              sets: true,
              reps: true,
              weightKg: true,
              rpe: true,
              isCompleted: true,
              durationSec: true,
              restSeconds: true,
              volume: true,
              estimated1Rm: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
        orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }],
        take: effectiveLimit,
      });
    },
  );
}

export async function getPersonalRecords(userId: string) {
  return readThroughCache(
    cacheNamespaces.workoutPrs,
    serializeCacheKey([userId]),
    WORKOUT_PRS_TTL_MS,
    async () =>
      prisma.personalRecord.findMany({
        where: { userId },
        orderBy: [{ bestWeightKg: 'desc' }, { bestVolume: 'desc' }],
      }),
  );
}

export async function getWorkoutSessionDetail(userId: string, sessionId: string) {
  const session = await prisma.workoutSession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
    include: {
      entries: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!session) {
    throw new HttpError(404, 'Workout session not found');
  }

  return session;
}

export async function compareWorkoutSessions(userId: string, currentSessionId: string, previousSessionId?: string) {
  const currentSession = await getWorkoutSessionDetail(userId, currentSessionId);

  const previousSession = previousSessionId
    ? await getWorkoutSessionDetail(userId, previousSessionId)
    : await prisma.workoutSession.findFirst({
        where: {
          userId,
          id: {
            not: currentSession.id,
          },
          sessionDate: {
            lte: currentSession.sessionDate,
          },
        },
        include: {
          entries: true,
        },
        orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }],
      });

  if (!previousSession) {
    return {
      currentSession,
      previousSession: null,
      comparisons: [],
    };
  }

  const summarize = (entries: Array<{ exerciseName: string; volume: number; weightKg: number | null }>) => {
    const map = new Map<string, { volume: number; topWeightKg: number }>();

    for (const entry of entries) {
      const key = entry.exerciseName;
      const current = map.get(key) ?? { volume: 0, topWeightKg: 0 };
      current.volume += entry.volume;
      current.topWeightKg = Math.max(current.topWeightKg, entry.weightKg ?? 0);
      map.set(key, current);
    }

    return map;
  };

  const currentSummary = summarize(currentSession.entries);
  const previousSummary = summarize(previousSession.entries);
  const allExercises = new Set([...currentSummary.keys(), ...previousSummary.keys()]);

  const comparisons = Array.from(allExercises)
    .map((exerciseName) => {
      const current = currentSummary.get(exerciseName) ?? { volume: 0, topWeightKg: 0 };
      const previous = previousSummary.get(exerciseName) ?? { volume: 0, topWeightKg: 0 };

      return {
        exerciseName,
        currentTopWeightKg: Number(current.topWeightKg.toFixed(2)),
        previousTopWeightKg: Number(previous.topWeightKg.toFixed(2)),
        deltaTopWeightKg: Number((current.topWeightKg - previous.topWeightKg).toFixed(2)),
        currentVolume: Number(current.volume.toFixed(2)),
        previousVolume: Number(previous.volume.toFixed(2)),
        deltaVolume: Number((current.volume - previous.volume).toFixed(2)),
      };
    })
    .sort((a, b) => b.deltaTopWeightKg - a.deltaTopWeightKg);

  return {
    currentSession,
    previousSession,
    comparisons,
  };
}

type SuggestedEntry = {
  weightKg: number | null;
  reps: number;
  rpe: number | null;
  estimated1Rm: number;
  isCompleted: boolean;
  session: {
    sessionDate: Date;
  };
};

async function findLatestEntryForSuggestion(
  userId: string,
  exerciseName: string,
): Promise<SuggestedEntry | null> {
  const findByExercise = (useCaseInsensitive: boolean) =>
    prisma.workoutEntry.findFirst({
      where: {
        ...(useCaseInsensitive
          ? {
              exerciseName: {
                equals: exerciseName,
                mode: 'insensitive',
              },
            }
          : { exerciseName }),
        session: {
          userId,
        },
      },
      select: {
        weightKg: true,
        reps: true,
        rpe: true,
        estimated1Rm: true,
        isCompleted: true,
        session: {
          select: {
            sessionDate: true,
          },
        },
      },
      orderBy: [{ session: { sessionDate: 'desc' } }, { createdAt: 'desc' }],
    });

  const exact = await findByExercise(false);
  if (exact) {
    return exact;
  }

  return findByExercise(true);
}

async function findCustomExerciseForSuggestion(userId: string, exerciseName: string) {
  const exact = await prisma.customExercise.findFirst({
    where: {
      userId,
      name: exerciseName,
    },
  });

  if (exact) {
    return exact;
  }

  return prisma.customExercise.findFirst({
    where: {
      userId,
      name: {
        equals: exerciseName,
        mode: 'insensitive',
      },
    },
  });
}

export async function getWorkoutSuggestion(userId: string, exerciseName: string) {
  const requestedExerciseName = exerciseName.trim();
  const normalizedExerciseName = normalizeExerciseName(requestedExerciseName);

  return readThroughCache(
    cacheNamespaces.workoutSuggestion,
    serializeCacheKey([userId, normalizedExerciseName]),
    WORKOUT_SUGGESTION_TTL_MS,
    async () => {
      const [latestEntry, customExercise] = await Promise.all([
        findLatestEntryForSuggestion(userId, requestedExerciseName),
        findCustomExerciseForSuggestion(userId, requestedExerciseName),
      ]);

      const exerciseType = inferExerciseType(requestedExerciseName, customExercise?.exerciseType);
      const suggestedRestSeconds = isBenchVariant(requestedExerciseName)
        ? benchRestSecondsByReps(latestEntry?.reps ?? null)
        : customExercise?.defaultRestSeconds ?? defaultRestByType(exerciseType);

      if (!latestEntry) {
        return {
          exerciseName: requestedExerciseName,
          hasPreviousData: false,
          suggestedWeightKg: null,
          suggestedRestSeconds,
          exerciseType,
          rationale: 'No previous session found. Start conservative and track completion to unlock overload recommendations.',
        };
      }

      const lastWeightKg = latestEntry.weightKg ?? 0;
      const shouldIncrease = Boolean(latestEntry.isCompleted && lastWeightKg > 0);
      const suggestedWeightKg = shouldIncrease ? Number((lastWeightKg + 2.5).toFixed(2)) : lastWeightKg;

      return {
        exerciseName: requestedExerciseName,
        hasPreviousData: true,
        lastSessionDate: latestEntry.session.sessionDate,
        lastWeightKg,
        lastReps: latestEntry.reps,
        lastRpe: latestEntry.rpe,
        lastEstimated1Rm: latestEntry.estimated1Rm,
        wasCompleted: latestEntry.isCompleted,
        suggestedWeightKg,
        suggestedRestSeconds,
        exerciseType,
        rationale: shouldIncrease
          ? 'Last session was completed, so progressive overload suggests +2.5kg.'
          : 'Keep load stable until all sets are completed with good technique.',
      };
    },
  );
}

function dateOnlyKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getWorkoutAnalytics(userId: string, weeks = 8) {
  return readThroughCache(
    cacheNamespaces.workoutAnalytics,
    serializeCacheKey([userId, weeks]),
    WORKOUT_ANALYTICS_TTL_MS,
    async () => {
      const weeklyStatsDesc = await prisma.weeklyWorkoutStat.findMany({
        where: { userId },
        orderBy: { isoWeek: 'desc' },
        take: Math.max(1, weeks),
      });
      const weeklyStats = [...weeklyStatsDesc].reverse();

      const currentWeek = toIsoWeek(new Date());
      const thisWeek = weeklyStats.find((item) => item.isoWeek === currentWeek) ?? null;

      const sessions = await prisma.workoutSession.findMany({
        where: { userId },
        select: { sessionDate: true },
        orderBy: { sessionDate: 'desc' },
        take: 180,
      });

      const uniqueDates = Array.from(new Set(sessions.map((session) => dateOnlyKey(session.sessionDate))));
      let streakDays = 0;

      if (uniqueDates.length > 0) {
        streakDays = 1;

        for (let index = 1; index < uniqueDates.length; index += 1) {
          const prev = new Date(uniqueDates[index - 1] as string);
          const curr = new Date(uniqueDates[index] as string);
          const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);

          if (diffDays === 1) {
            streakDays += 1;
          } else {
            break;
          }
        }
      }

      const strongestThisWeek = thisWeek?.strongestLiftKg ?? 0;

      return {
        weeks: weeklyStats,
        thisWeek: {
          isoWeek: currentWeek,
          sessionsCount: thisWeek?.sessionsCount ?? 0,
          totalVolume: thisWeek?.totalVolume ?? 0,
          strongestLiftKg: strongestThisWeek,
        },
        streakDays,
      };
    },
  );
}

export async function exportWorkoutHistoryCsv(userId: string): Promise<string> {
  const sessions = await prisma.workoutSession.findMany({
    where: { userId },
    include: {
      entries: true,
    },
    orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }],
  });

  const header = [
    'sessionDate',
    'exerciseName',
    'sets',
    'reps',
    'weightKg',
    'rpe',
    'restSeconds',
    'volume',
    'estimated1Rm',
    'isCompleted',
  ];

  const lines = [header.join(',')];

  for (const session of sessions) {
    for (const entry of session.entries) {
      const values = [
        session.sessionDate.toISOString().slice(0, 10),
        entry.exerciseName,
        String(entry.sets),
        String(entry.reps),
        String(entry.weightKg ?? ''),
        String(entry.rpe ?? ''),
        String(entry.restSeconds ?? ''),
        String(Number(entry.volume.toFixed(2))),
        String(Number(entry.estimated1Rm.toFixed(2))),
        String(entry.isCompleted),
      ].map((value) => `"${String(value).replaceAll('"', '""')}"`);

      lines.push(values.join(','));
    }
  }

  return `${lines.join('\n')}\n`;
}
