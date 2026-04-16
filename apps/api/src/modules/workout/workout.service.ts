import { ExerciseType, Prisma } from '@prisma/client';

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
const WORKOUT_EXPORT_BATCH_SIZE = 100;
const COMMON_PROGRESS_WEEKS: ReadonlyArray<number> = [8, 12, 16, 24];
const COMMON_ANALYTIC_WEEKS: ReadonlyArray<number> = [8, 12, 16, 24];

type WorkoutSessionWithEntries = Prisma.WorkoutSessionGetPayload<{
  include: {
    entries: true;
  };
}>;

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

// ── Q6: Batched PR upserts ─────────────────────────────────────────────
// Instead of N sequential findUnique + create/update calls, we:
// 1. Aggregate the best weight/volume per exercise from input entries
// 2. Fetch all existing PRs for those exercises in one query
// 3. Batch update/create as needed

type EntryPrCandidate = {
  exerciseName: string;
  weightKg: number;
  volume: number;
};

async function batchUpsertPersonalRecords(
  tx: Prisma.TransactionClient,
  userId: string,
  sessionId: string,
  isoWeek: string,
  candidates: EntryPrCandidate[],
  achievedAt: Date,
): Promise<void> {
  // Aggregate best weight/volume per exercise from all entries
  const bestByExercise = new Map<string, { weightKg: number; volume: number }>();
  for (const candidate of candidates) {
    const current = bestByExercise.get(candidate.exerciseName);
    if (!current) {
      bestByExercise.set(candidate.exerciseName, { weightKg: candidate.weightKg, volume: candidate.volume });
    } else {
      current.weightKg = Math.max(current.weightKg, candidate.weightKg);
      current.volume = Math.max(current.volume, candidate.volume);
    }
  }

  const exerciseNames = Array.from(bestByExercise.keys());
  if (exerciseNames.length === 0) {
    return;
  }

  // Single query to fetch all existing PRs
  const existingPrs = await tx.personalRecord.findMany({
    where: {
      userId,
      exerciseName: { in: exerciseNames },
    },
  });

  const existingByName = new Map(existingPrs.map((pr) => [pr.exerciseName, pr]));
  const prEvents: Array<{
    userId: string;
    sessionId: string;
    exerciseName: string;
    bestWeightKg: number;
    bestVolume: number;
    achievedAt: Date;
    isoWeek: string;
  }> = [];

  for (const [exerciseName, best] of bestByExercise) {
    const existing = existingByName.get(exerciseName);

    if (!existing) {
      await tx.personalRecord.create({
        data: {
          userId,
          exerciseName,
          bestWeightKg: best.weightKg,
          bestVolume: best.volume,
          achievedAt,
        },
      });
      prEvents.push({
        userId,
        sessionId,
        exerciseName,
        bestWeightKg: best.weightKg,
        bestVolume: best.volume,
        achievedAt,
        isoWeek,
      });
      continue;
    }

    const nextBestWeightKg = Math.max(existing.bestWeightKg, best.weightKg);
    const nextBestVolume = Math.max(existing.bestVolume, best.volume);

    if (nextBestWeightKg !== existing.bestWeightKg || nextBestVolume !== existing.bestVolume) {
      await tx.personalRecord.update({
        where: { id: existing.id },
        data: {
          bestWeightKg: nextBestWeightKg,
          bestVolume: nextBestVolume,
          achievedAt,
        },
      });
      prEvents.push({
        userId,
        sessionId,
        exerciseName,
        bestWeightKg: nextBestWeightKg,
        bestVolume: nextBestVolume,
        achievedAt,
        isoWeek,
      });
    }
  }

  // Batch insert all PR events at once
  if (prEvents.length > 0) {
    await tx.personalRecordEvent.createMany({ data: prEvents });
  }
}

function isUniqueConstraintError(error: unknown, expectedFields: readonly string[]): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== 'P2002') {
    return false;
  }

  const targetRaw = (error.meta as { target?: unknown } | undefined)?.target;
  const target = Array.isArray(targetRaw)
    ? targetRaw.map((value) => String(value))
    : typeof targetRaw === 'string'
      ? [targetRaw]
      : [];

  return expectedFields.every((field) => target.some((value) => value.includes(field)));
}

export async function createWorkoutSession(userId: string, input: CreateWorkoutInput) {
  const idempotencyKey = input.idempotencyKey?.trim() ? input.idempotencyKey.trim() : null;
  const timezoneOffsetMinutes = typeof input.timezoneOffsetMinutes === 'number'
    ? input.timezoneOffsetMinutes
    : null;
  const sessionDate = timezoneOffsetMinutes !== null
    ? toSessionDateOnlyInTimezone(input.startedAt, timezoneOffsetMinutes)
    : toSessionDateOnly(input.sessionDate);
  const endedAt = input.endedAt ?? new Date();
  const normalizedNotes = input.notes?.trim() ? input.notes.trim() : undefined;
  const sessionIsoWeek = toIsoWeek(sessionDate);

  let wasReplay = false;

  let session: WorkoutSessionWithEntries | null = null;

  try {
    session = await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existingRequest = await tx.workoutRequestLog.findUnique({
          where: {
            userId_idempotencyKey: {
              userId,
              idempotencyKey,
            },
          },
          select: {
            sessionId: true,
          },
        });

        if (existingRequest) {
          const existingSessionFromRequest = await tx.workoutSession.findFirst({
            where: {
              id: existingRequest.sessionId,
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

          if (existingSessionFromRequest) {
            wasReplay = true;
            return existingSessionFromRequest;
          }
        }
      }

      const existingSession = await tx.workoutSession.findUnique({
        where: {
          userId_sessionDate: {
            userId,
            sessionDate,
          },
        },
        select: {
          id: true,
          startedAt: true,
          totalVolume: true,
          timezoneOffsetMinutes: true,
        },
      });

      let sessionRecord: { id: string; totalVolume: number };
      let isNewDailySession = false;

      if (existingSession) {
        sessionRecord = await tx.workoutSession.update({
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
        });
      } else {
        try {
          sessionRecord = await tx.workoutSession.create({
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
          isNewDailySession = true;
        } catch (error) {
          if (!isUniqueConstraintError(error, ['userId', 'sessionDate'])) {
            throw error;
          }

          const concurrentSession = await tx.workoutSession.findUnique({
            where: {
              userId_sessionDate: {
                userId,
                sessionDate,
              },
            },
            select: {
              id: true,
              startedAt: true,
              totalVolume: true,
              timezoneOffsetMinutes: true,
            },
          });

          if (!concurrentSession) {
            throw error;
          }

          sessionRecord = await tx.workoutSession.update({
            where: { id: concurrentSession.id },
            data: {
              startedAt:
                concurrentSession.startedAt.getTime() <= input.startedAt.getTime()
                  ? concurrentSession.startedAt
                  : input.startedAt,
              endedAt,
              timezoneOffsetMinutes: timezoneOffsetMinutes ?? concurrentSession.timezoneOffsetMinutes,
              ...(normalizedNotes ? { notes: normalizedNotes } : {}),
            },
            select: {
              id: true,
              totalVolume: true,
            },
          });
        }
      }

      // ── Q5: Batch entry inserts ────────────────────────────────
      const entryData = input.entries.map((entry) => {
        const volume = calculateVolume(entry.sets, entry.reps, entry.weightKg);
        const estimated1Rm = calculateEstimatedOneRm(entry.weightKg, entry.reps);
        return {
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
        };
      });

      await tx.workoutEntry.createMany({ data: entryData });

      let totalVolume = 0;
      let strongestLiftKg = 0;
      const prCandidates: EntryPrCandidate[] = [];

      for (const entry of entryData) {
        totalVolume += entry.volume;
        strongestLiftKg = Math.max(strongestLiftKg, entry.weightKg ?? 0);
        prCandidates.push({
          exerciseName: entry.exerciseName,
          weightKg: entry.weightKg ?? 0,
          volume: entry.volume,
        });
      }

      // ── Q6: Batch PR upserts ──────────────────────────────────
      await batchUpsertPersonalRecords(
        tx,
        userId,
        sessionRecord.id,
        sessionIsoWeek,
        prCandidates,
        endedAt,
      );

      // ── Q7: Single upsert for weekly stat ─────────────────────
      // Raw SQL ON CONFLICT handles MAX(existing, new) for strongestLiftKg
      // which Prisma's upsert API cannot express natively.
      const weeklyVolume = Number(totalVolume.toFixed(2));
      const sessionIncrement = isNewDailySession ? 1 : 0;

      await tx.$executeRaw`
        INSERT INTO "WeeklyWorkoutStat" ("id", "userId", "isoWeek", "totalVolume", "sessionsCount", "strongestLiftKg", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${userId}, ${sessionIsoWeek}, ${weeklyVolume}, 1, ${strongestLiftKg}, NOW(), NOW())
        ON CONFLICT ("userId", "isoWeek")
        DO UPDATE SET
          "totalVolume"     = "WeeklyWorkoutStat"."totalVolume" + ${weeklyVolume},
          "sessionsCount"   = "WeeklyWorkoutStat"."sessionsCount" + ${sessionIncrement},
          "strongestLiftKg" = GREATEST("WeeklyWorkoutStat"."strongestLiftKg", ${strongestLiftKg}),
          "updatedAt"       = NOW()
      `;

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

      if (idempotencyKey) {
        await tx.workoutRequestLog.create({
          data: {
            userId,
            sessionId: updatedSession.id,
            idempotencyKey,
          },
        });
      }

      return updatedSession;
    });
  } catch (error) {
    if (idempotencyKey && isUniqueConstraintError(error, ['userId', 'idempotencyKey'])) {
      const existingRequest = await prisma.workoutRequestLog.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey,
          },
        },
        select: {
          sessionId: true,
        },
      });

      if (existingRequest) {
        const existingSession = await prisma.workoutSession.findFirst({
          where: {
            id: existingRequest.sessionId,
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

        if (existingSession) {
          wasReplay = true;
          session = existingSession;
        }
      }
    }

    if (!session) {
      throw error;
    }
  }

  if (wasReplay) {
    return session;
  }

  const normalizedExerciseNames = Array.from(
    new Set(input.entries.map((entry) => normalizeExerciseName(entry.exerciseName))),
  );

  const cacheEntries: Array<{ namespace: string; key: string }> = [
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

  invalidateCacheNamespace(cacheNamespaces.dashboardOverview);
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
        select: {
          exerciseName: true,
          bestWeightKg: true,
          bestVolume: true,
          achievedAt: true,
        },
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
  sessionDate: Date;
};

async function findLatestEntryForSuggestion(
  userId: string,
  exerciseName: string,
): Promise<SuggestedEntry | null> {
  const findByExercise = async (useCaseInsensitive: boolean): Promise<SuggestedEntry | null> => {
    const exerciseNameComparator = useCaseInsensitive
      ? Prisma.sql`LOWER(we."exerciseName") = LOWER(${exerciseName})`
      : Prisma.sql`we."exerciseName" = ${exerciseName}`;

    const rows = await prisma.$queryRaw<SuggestedEntry[]>`
      SELECT
        we."weightKg" AS "weightKg",
        we."reps" AS "reps",
        we."rpe" AS "rpe",
        we."estimated1Rm" AS "estimated1Rm",
        we."isCompleted" AS "isCompleted",
        ws."sessionDate" AS "sessionDate"
      FROM "WorkoutEntry" AS we
      INNER JOIN "WorkoutSession" AS ws ON ws."id" = we."sessionId"
      WHERE ws."userId" = ${userId}
        AND ${exerciseNameComparator}
      ORDER BY ws."sessionDate" DESC, we."createdAt" DESC
      LIMIT 1
    `;

    return rows[0] ?? null;
  };

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
        lastSessionDate: latestEntry.sessionDate,
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


export async function getWorkoutAnalytics(userId: string, weeks = 8) {
  return readThroughCache(
    cacheNamespaces.workoutAnalytics,
    serializeCacheKey([userId, weeks]),
    WORKOUT_ANALYTICS_TTL_MS,
    async () => {
      const weeklyStatsDesc = await prisma.weeklyWorkoutStat.findMany({
        where: { userId },
        select: {
          isoWeek: true,
          totalVolume: true,
          sessionsCount: true,
          strongestLiftKg: true,
        },
        orderBy: { isoWeek: 'desc' },
        take: Math.max(1, weeks),
      });
      const weeklyStats = [...weeklyStatsDesc].reverse();

      const currentWeek = toIsoWeek(new Date());
      const thisWeek = weeklyStats.find((item) => item.isoWeek === currentWeek) ?? null;

      // ── Q9: SQL window-function streak (shared pattern with dashboard) ──
      const streakRows = await prisma.$queryRaw<Array<{ streak_days: number }>>`
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
      const streakDays = streakRows[0]?.streak_days ?? 0;

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

function escapeCsvValue(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

// ── Q10: Cursor-based CSV export ─────────────────────────────────────
export async function* exportWorkoutHistoryCsvLines(userId: string): AsyncGenerator<string> {
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

  yield `${header.join(',')}\n`;

  let cursor: string | undefined;

  while (true) {
    const sessions = await prisma.workoutSession.findMany({
      where: { userId },
      select: {
        id: true,
        sessionDate: true,
        entries: {
          select: {
            exerciseName: true,
            sets: true,
            reps: true,
            weightKg: true,
            rpe: true,
            restSeconds: true,
            volume: true,
            estimated1Rm: true,
            isCompleted: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }],
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
      take: WORKOUT_EXPORT_BATCH_SIZE,
    });

    if (sessions.length === 0) {
      break;
    }

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
        ].map((value) => escapeCsvValue(String(value)));

        yield `${values.join(',')}\n`;
      }
    }

    cursor = sessions.at(-1)!.id;

    if (sessions.length < WORKOUT_EXPORT_BATCH_SIZE) {
      break;
    }
  }
}
