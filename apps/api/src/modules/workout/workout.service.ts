import type { Prisma } from '@prisma/client';
import { ExerciseType } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import { enqueueWorkoutGamificationJob } from '../gamification/gamification.queue.js';
import { processWorkoutGamificationJob } from '../gamification/gamification.service.js';
import {
  cacheNamespaces,
  invalidateCacheNamespace,
  invalidateCacheKeys,
  readThroughCache,
  serializeCacheKey,
} from '../../utils/cache.js';
import { HttpError } from '../../utils/http-error.js';
import type { CreateWorkoutInput, WorkoutHistoryQueryInput } from './workout.schemas.js';

const WORKOUT_HISTORY_TTL_MS = 180_000;
const WORKOUT_PRS_TTL_MS = 45_000;
const WORKOUT_ANALYTICS_TTL_MS = 30_000;
const WORKOUT_SUGGESTION_TTL_MS = 20_000;
const WORKOUT_HISTORY_DEFAULT_LIMIT = 30;
const WORKOUT_HISTORY_PREVIEW_ENTRIES_LIMIT = 3;
const COMMON_PROGRESS_WEEKS: ReadonlyArray<number> = [8, 12, 16, 24];
const COMMON_ANALYTIC_WEEKS: ReadonlyArray<number> = [8, 12, 16, 24];

export function calculateVolume(sets: number, reps: number, weightKg?: number): number {
  if (!weightKg) {
    return 0;
  }

  return Number((sets * reps * weightKg).toFixed(2));
}

export function calculateEstimatedOneRm(weightKg?: number, reps?: number): number {
  if (!weightKg || !reps) {
    return 0;
  }

  // Epley formula: 1RM = weight * (1 + reps / 30)
  return Number((weightKg * (1 + reps / 30)).toFixed(2));
}

export function toIsoWeek(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function toSessionDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toSessionDateOnlyInTimezone(referenceUtc: Date, timezoneOffsetMinutes: number): Date {
  const localTime = new Date(referenceUtc.getTime() + timezoneOffsetMinutes * 60_000);
  return new Date(Date.UTC(localTime.getUTCFullYear(), localTime.getUTCMonth(), localTime.getUTCDate()));
}

export function nextUtcDate(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + 1);
  return copy;
}

function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase();
}

export function suggestOverloadWeight(lastWeightKg: number, wasCompleted: boolean): number {
  if (!(wasCompleted && lastWeightKg > 0)) {
    return Number(lastWeightKg.toFixed(2));
  }

  return Number((lastWeightKg + 2.5).toFixed(2));
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
  sessionId: string,
  isoWeek: string,
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
    const created = await tx.personalRecord.create({
      data: {
        userId,
        exerciseName,
        bestWeightKg: weightKg,
        bestVolume: volume,
        achievedAt,
      },
    });

    await tx.personalRecordEvent.create({
      data: {
        userId,
        sessionId,
        exerciseName,
        bestWeightKg: created.bestWeightKg,
        bestVolume: created.bestVolume,
        achievedAt,
        isoWeek,
      },
    });
    return;
  }

  const bestWeightKg = Math.max(current.bestWeightKg, weightKg);
  const bestVolume = Math.max(current.bestVolume, volume);

  if (bestWeightKg !== current.bestWeightKg || bestVolume !== current.bestVolume) {
    const updated = await tx.personalRecord.update({
      where: { id: current.id },
      data: {
        bestWeightKg,
        bestVolume,
        achievedAt,
      },
    });

    await tx.personalRecordEvent.create({
      data: {
        userId,
        sessionId,
        exerciseName,
        bestWeightKg: updated.bestWeightKg,
        bestVolume: updated.bestVolume,
        achievedAt,
        isoWeek,
      },
    });
  }
}

export async function createWorkoutSession(userId: string, input: CreateWorkoutInput) {
  const timezoneOffsetMinutes = typeof input.timezoneOffsetMinutes === 'number'
    ? input.timezoneOffsetMinutes
    : null;
  const sessionDate = timezoneOffsetMinutes !== null
    ? toSessionDateOnlyInTimezone(input.startedAt, timezoneOffsetMinutes)
    : toSessionDateOnly(input.sessionDate);
  const sessionDateNext = nextUtcDate(sessionDate);
  const endedAt = input.endedAt ?? new Date();
  const normalizedNotes = input.notes?.trim() ? input.notes.trim() : undefined;
  const sessionIsoWeek = toIsoWeek(sessionDate);

  const session = await prisma.$transaction(async (tx) => {
    const existingSession = await tx.workoutSession.findFirst({
      where: {
        userId,
        sessionDate: {
          gte: sessionDate,
          lt: sessionDateNext,
        },
      },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        totalVolume: true,
        timezoneOffsetMinutes: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const sessionRecord = existingSession
      ? await tx.workoutSession.update({
          where: { id: existingSession.id },
          data: {
            startedAt:
              existingSession.startedAt.getTime() <= input.startedAt.getTime()
                ? existingSession.startedAt
                : input.startedAt,
            endedAt,
            timezoneOffsetMinutes: timezoneOffsetMinutes ?? existingSession.timezoneOffsetMinutes,
            ...(normalizedNotes ? { notes: normalizedNotes } : {}),
          },
          select: {
            id: true,
            totalVolume: true,
          },
        })
      : await tx.workoutSession.create({
          data: {
            userId,
            sessionDate,
            startedAt: input.startedAt,
            endedAt,
            notes: normalizedNotes,
            timezoneOffsetMinutes,
          },
          select: {
            id: true,
            totalVolume: true,
          },
        });

    const isNewDailySession = !existingSession;

    let totalVolume = 0;
    let strongestLiftKg = 0;

    for (const entry of input.entries) {
      const volume = calculateVolume(entry.sets, entry.reps, entry.weightKg);
      const estimated1Rm = calculateEstimatedOneRm(entry.weightKg, entry.reps);
      totalVolume += volume;
      strongestLiftKg = Math.max(strongestLiftKg, entry.weightKg ?? 0);

      await tx.workoutEntry.create({
        data: {
          sessionId: sessionRecord.id,
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
        sessionRecord.id,
        sessionIsoWeek,
        entry.exerciseName,
        entry.weightKg ?? 0,
        volume,
        endedAt,
      );
    }

    const existingWeekly = await tx.weeklyWorkoutStat.findUnique({
      where: {
        userId_isoWeek: {
          userId,
          isoWeek: sessionIsoWeek,
        },
      },
    });

    if (existingWeekly) {
      await tx.weeklyWorkoutStat.update({
        where: { id: existingWeekly.id },
        data: {
          totalVolume: Number((existingWeekly.totalVolume + totalVolume).toFixed(2)),
          sessionsCount: isNewDailySession ? existingWeekly.sessionsCount + 1 : existingWeekly.sessionsCount,
          strongestLiftKg: Math.max(existingWeekly.strongestLiftKg, strongestLiftKg),
        },
      });
    } else {
      await tx.weeklyWorkoutStat.create({
        data: {
          userId,
          isoWeek: sessionIsoWeek,
          totalVolume,
          sessionsCount: 1,
          strongestLiftKg,
        },
      });
    }

    const nextSessionTotalVolume = Number(((sessionRecord.totalVolume ?? 0) + totalVolume).toFixed(2));

    const updatedSession = await tx.workoutSession.update({
      where: { id: sessionRecord.id },
      data: {
        totalVolume: nextSessionTotalVolume,
        endedAt,
        ...(normalizedNotes ? { notes: normalizedNotes } : {}),
      },
      include: {
        entries: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    await tx.userGamificationStat.upsert({
      where: {
        userId,
      },
      update: {
        totalVolumeLifted: {
          increment: totalVolume,
        },
      },
      create: {
        userId,
        totalVolumeLifted: totalVolume,
        maxSessionVolume: nextSessionTotalVolume,
        maxWeightKg: strongestLiftKg,
      },
    });

    if (nextSessionTotalVolume > 0) {
      await tx.userGamificationStat.updateMany({
        where: {
          userId,
          maxSessionVolume: {
            lt: nextSessionTotalVolume,
          },
        },
        data: {
          maxSessionVolume: nextSessionTotalVolume,
        },
      });
    }

    if (strongestLiftKg > 0) {
      await tx.userGamificationStat.updateMany({
        where: {
          userId,
          maxWeightKg: {
            lt: strongestLiftKg,
          },
        },
        data: {
          maxWeightKg: strongestLiftKg,
        },
      });
    }

    return updatedSession;
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

  invalidateCacheNamespace(cacheNamespaces.workoutHistory);
  invalidateCacheKeys(cacheEntries);

  const gamificationJobPayload = {
    userId,
    sessionId: session.id,
    sessionDate,
    entries: input.entries,
    jobKey: `workout:${session.id}:${Date.now()}:${crypto.randomUUID()}`,
  };

  void enqueueWorkoutGamificationJob(gamificationJobPayload)
    .then((queued) => {
      if (queued) {
        return;
      }

      return processWorkoutGamificationJob(gamificationJobPayload);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('[gamification] async queue/pipeline failed', error);
    });

  return session;
}

export async function getWorkoutHistory(userId: string, query: WorkoutHistoryQueryInput = {}) {
  const effectiveLimit = query.limit ?? WORKOUT_HISTORY_DEFAULT_LIMIT;
  const effectiveCursor = query.cursor ?? null;

  const sessionDateFilter: Prisma.DateTimeFilter = {};
  if (query.from) {
    sessionDateFilter.gte = query.from;
  }
  if (query.to) {
    sessionDateFilter.lte = query.to;
  }

  return readThroughCache(
    cacheNamespaces.workoutHistory,
    serializeCacheKey([
      userId,
      query.from?.toISOString() ?? null,
      query.to?.toISOString() ?? null,
      effectiveLimit,
      effectiveCursor,
    ]),
    WORKOUT_HISTORY_TTL_MS,
    async () => {
      if (effectiveCursor) {
        const cursorSession = await prisma.workoutSession.findFirst({
          where: {
            id: effectiveCursor,
            userId,
            ...(query.from || query.to
              ? {
                  sessionDate: sessionDateFilter,
                }
              : {}),
          },
          select: {
            id: true,
          },
        });

        if (!cursorSession) {
          throw new HttpError(400, 'Invalid workout history cursor');
        }
      }

      const rows = await prisma.workoutSession.findMany({
        where: {
          userId,
          ...(query.from || query.to
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
          totalVolume: true,
          entries: {
            select: {
              exerciseName: true,
              sets: true,
              reps: true,
              weightKg: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
            take: WORKOUT_HISTORY_PREVIEW_ENTRIES_LIMIT,
          },
        },
        orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        ...(effectiveCursor
          ? {
              cursor: {
                id: effectiveCursor,
              },
              skip: 1,
            }
          : {}),
        take: effectiveLimit + 1,
      });

      const hasMore = rows.length > effectiveLimit;
      const items = hasMore ? rows.slice(0, effectiveLimit) : rows;
      const nextCursor = hasMore
        ? (items.at(-1)?.id ?? null)
        : null;

      return {
        items,
        pagination: {
          limit: effectiveLimit,
          cursor: effectiveCursor,
          hasMore,
          nextCursor,
        },
      };
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
      const suggestedWeightKg = suggestOverloadWeight(lastWeightKg, shouldIncrease);

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
