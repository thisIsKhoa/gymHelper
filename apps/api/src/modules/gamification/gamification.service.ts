import { AchievementCode, GamificationNotificationType, MuscleGroup, MuscleSkill, Prisma } from '@prisma/client';

import { prisma } from '../../db/prisma.js';
import { cacheNamespaces, invalidateCacheKey, invalidateCacheNamespace, readThroughCache, serializeCacheKey } from '../../utils/cache.js';
import {
  ACHIEVEMENT_DEFINITIONS,
  BODYWEIGHT_REP_EXP,
  LEVEL_EXP_BASE,
  LEVEL_EXP_GROWTH,
  MUSCLE_SKILL_LABEL,
  MUSCLE_SKILL_ORDER,
  RPE_MULTIPLIERS,
  SECOND_SESSION_WEEKLY_COMBO,
} from './gamification.constants.js';
import { publishGamificationRealtimeEvent } from './gamification.realtime.js';
import type { GamificationJobPayload, WorkoutGamificationEntryInput, WorkoutGamificationPayload } from './gamification.types.js';

const GAMIFICATION_PROFILE_TTL_MS = 30_000;
const MIN_NOTIFICATION_BATCH = 1;
const MAX_NOTIFICATION_BATCH = 20;

let userExerciseStatTableAvailable: boolean | null = null;

type Tx = Prisma.TransactionClient;

export interface GamificationNotificationItem {
  id: string;
  type: GamificationNotificationType;
  title: string;
  message: string;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

type SkillExpAggregation = {
  baseExp: number;
  weightedExp: number;
};

type LevelState = {
  level: number;
  expIntoLevel: number;
  expForNextLevel: number;
  progressPct: number;
};

const latKeywords = ['lat', 'pulldown', 'pull up', 'pull-up', 'chin up', 'chin-up'];
const chestKeywords = ['bench', 'chest fly', 'pec deck', 'push up', 'push-up', 'dip'];
const coreKeywords = ['plank', 'crunch', 'abs', 'core', 'rollout', 'twist', 'leg raise'];
const backKeywords = ['row', 'deadlift', 'rack pull', 'back extension', 'good morning'];
const legKeywords = ['squat', 'leg press', 'lunge', 'calf', 'ham', 'glute', 'hip thrust', 'step up', 'step-up'];
const armKeywords = [
  'curl',
  'tricep',
  'bicep',
  'skull crusher',
  'pushdown',
  'kickback',
  'shoulder',
  'lateral raise',
  'rear delt',
  'front raise',
  'upright row',
  'face pull',
  'overhead press',
  'arnold press',
  'push press',
];

function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toIsoWeek(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function dateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateOnlyKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function containsAnyKeyword(name: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => name.includes(keyword));
}

function resolveMuscleSkillFromGroup(muscleGroup: MuscleGroup, exerciseName: string): MuscleSkill {
  if (muscleGroup === MuscleGroup.BACK) {
    return containsAnyKeyword(exerciseName, latKeywords) ? MuscleSkill.LATS : MuscleSkill.BACK;
  }

  if (muscleGroup === MuscleGroup.CHEST) {
    return MuscleSkill.CHEST;
  }

  if (muscleGroup === MuscleGroup.CORE) {
    return MuscleSkill.CORE;
  }

  if (muscleGroup === MuscleGroup.SHOULDERS || muscleGroup === MuscleGroup.ARMS) {
    return MuscleSkill.ARMS;
  }

  if (muscleGroup === MuscleGroup.LEGS || muscleGroup === MuscleGroup.GLUTES || muscleGroup === MuscleGroup.FULL_BODY) {
    return MuscleSkill.LEGS;
  }

  return MuscleSkill.CORE;
}

function resolveMuscleSkillByName(exerciseName: string): MuscleSkill {
  if (containsAnyKeyword(exerciseName, coreKeywords)) {
    return MuscleSkill.CORE;
  }

  if (containsAnyKeyword(exerciseName, chestKeywords)) {
    return MuscleSkill.CHEST;
  }

  if (containsAnyKeyword(exerciseName, latKeywords)) {
    return MuscleSkill.LATS;
  }

  if (containsAnyKeyword(exerciseName, backKeywords)) {
    return MuscleSkill.BACK;
  }

  if (containsAnyKeyword(exerciseName, legKeywords)) {
    return MuscleSkill.LEGS;
  }

  if (containsAnyKeyword(exerciseName, armKeywords)) {
    return MuscleSkill.ARMS;
  }

  return MuscleSkill.CORE;
}

function resolveRpeMultiplier(rpe?: number): number {
  if (typeof rpe !== 'number' || Number.isNaN(rpe)) {
    return RPE_MULTIPLIERS.base;
  }

  if (rpe >= 9) {
    return RPE_MULTIPLIERS.high;
  }

  if (rpe >= 8) {
    return RPE_MULTIPLIERS.mediumHigh;
  }

  if (rpe >= 7) {
    return RPE_MULTIPLIERS.medium;
  }

  return RPE_MULTIPLIERS.base;
}

function resolveEntryBaseExp(entry: WorkoutGamificationEntryInput): number {
  const weightedVolume = (entry.weightKg ?? 0) * entry.sets * entry.reps;

  if (weightedVolume > 0) {
    return Number(weightedVolume.toFixed(2));
  }

  const bodyweightEstimate = entry.sets * entry.reps * BODYWEIGHT_REP_EXP;
  return Number(bodyweightEstimate.toFixed(2));
}

function expRequiredForCurrentLevel(level: number): number {
  return Math.max(200, Math.round(LEVEL_EXP_BASE * Math.pow(level, LEVEL_EXP_GROWTH)));
}

function resolveLevelState(totalExpRaw: number): LevelState {
  const totalExp = Math.max(0, Number(totalExpRaw.toFixed(2)));
  let level = 1;
  let remaining = totalExp;
  let requirement = expRequiredForCurrentLevel(level);

  while (remaining >= requirement) {
    remaining -= requirement;
    level += 1;
    requirement = expRequiredForCurrentLevel(level);
  }

  return {
    level,
    expIntoLevel: Number(remaining.toFixed(2)),
    expForNextLevel: requirement,
    progressPct: Number(((remaining / requirement) * 100).toFixed(2)),
  };
}

function toProfileCacheKey(userId: string): string {
  return serializeCacheKey([userId]);
}

function toSessionMinuteInLocalTime(startedAtUtc: Date, timezoneOffsetMinutes: number | null): number {
  const offset = timezoneOffsetMinutes ?? 0;
  const local = new Date(startedAtUtc.getTime() + offset * 60_000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

function calculateLongestWorkoutStreak(sessionDates: Date[]): number {
  const uniqueSorted = Array.from(new Set(sessionDates.map((date) => dateOnlyKey(date)))).sort();
  if (uniqueSorted.length === 0) {
    return 0;
  }

  let longest = 1;
  let current = 1;

  for (let index = 1; index < uniqueSorted.length; index += 1) {
    const previous = new Date(uniqueSorted[index - 1] as string);
    const next = new Date(uniqueSorted[index] as string);
    const diffDays = Math.round((next.getTime() - previous.getTime()) / 86400000);

    if (diffDays === 1) {
      current += 1;
      longest = Math.max(longest, current);
      continue;
    }

    current = 1;
  }

  return longest;
}

function isoWeekToStartDate(isoWeek: string): Date | null {
  const [yearPart, weekPart] = isoWeek.split('-W');
  if (!yearPart || !weekPart) {
    return null;
  }

  const year = Number.parseInt(yearPart, 10);
  const week = Number.parseInt(weekPart, 10);

  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) {
    return null;
  }

  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dayOfWeek = simple.getUTCDay() || 7;
  const weekStart = new Date(simple);

  if (dayOfWeek <= 4) {
    weekStart.setUTCDate(simple.getUTCDate() - dayOfWeek + 1);
  } else {
    weekStart.setUTCDate(simple.getUTCDate() + 8 - dayOfWeek);
  }

  weekStart.setUTCHours(0, 0, 0, 0);
  return weekStart;
}

function calculatePrWeekStreak(isoWeeks: string[]): number {
  const uniqueSortedWeeks = Array.from(new Set(isoWeeks));
  const weekStarts = uniqueSortedWeeks
    .map((week) => ({ week, date: isoWeekToStartDate(week) }))
    .filter((item): item is { week: string; date: Date } => item.date instanceof Date)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (weekStarts.length === 0) {
    return 0;
  }

  let longest = 1;
  let current = 1;

  for (let index = 1; index < weekStarts.length; index += 1) {
    const previous = weekStarts[index - 1];
    const next = weekStarts[index];

    if (!previous || !next) {
      continue;
    }

    const diffDays = Math.round((next.date.getTime() - previous.date.getTime()) / 86400000);

    if (diffDays === 7) {
      current += 1;
      longest = Math.max(longest, current);
      continue;
    }

    current = 1;
  }

  return longest;
}

function calculateNoWorkoutOpenStreak(openDates: Date[], workoutDateKeySet: Set<string>): number {
  const uniqueSortedOpens = Array.from(new Set(openDates.map((date) => dateOnlyKey(date)))).sort();

  let longest = 0;
  let current = 0;
  let previousNoWorkoutDate: Date | null = null;

  for (const dateKey of uniqueSortedOpens) {
    if (workoutDateKeySet.has(dateKey)) {
      current = 0;
      previousNoWorkoutDate = null;
      continue;
    }

    const currentDate = new Date(dateKey);

    if (!previousNoWorkoutDate) {
      current = 1;
    } else {
      const diffDays = Math.round((currentDate.getTime() - previousNoWorkoutDate.getTime()) / 86400000);
      current = diffDays === 1 ? current + 1 : 1;
    }

    previousNoWorkoutDate = currentDate;
    longest = Math.max(longest, current);
  }

  return longest;
}

function toJsonPayload(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function isMissingUserExerciseStatTable(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code === 'P2021') {
    const table = (error.meta as { table?: unknown } | undefined)?.table;
    return typeof table !== 'string' || table.includes('UserExerciseStat');
  }

  if (error.code === 'P2010') {
    const code = (error.meta as { code?: unknown } | undefined)?.code;
    const message = (error.meta as { message?: unknown } | undefined)?.message;
    return code === '42P01' && typeof message === 'string' && message.includes('UserExerciseStat');
  }

  return false;
}

async function refreshUserExerciseStatsForSession(tx: Tx, userId: string, sessionId: string): Promise<void> {
  const touchedExercises = await tx.workoutEntry.findMany({
    where: {
      sessionId,
      weightKg: {
        not: null,
      },
    },
    select: {
      exerciseName: true,
    },
    distinct: ['exerciseName'],
  });

  const exerciseNames = touchedExercises.map((row) => row.exerciseName);

  if (exerciseNames.length === 0) {
    return;
  }

  const rows = await tx.$queryRaw<
    Array<{
      exercise_name: string;
      entry_count: number | bigint;
      first_weight_kg: number;
      latest_weight_kg: number;
      best_weight_kg: number;
      first_lift_at: Date;
      latest_lift_at: Date;
      best_lift_at: Date;
    }>
  >`
    WITH weighted AS (
      SELECT
        we."exerciseName" AS exercise_name,
        we."weightKg"::double precision AS weight_kg,
        ws."sessionDate" AS session_date,
        we."createdAt" AS created_at
      FROM "WorkoutEntry" AS we
      INNER JOIN "WorkoutSession" AS ws ON ws."id" = we."sessionId"
      WHERE ws."userId" = ${userId}
        AND we."weightKg" IS NOT NULL
        AND we."exerciseName" IN (${Prisma.join(exerciseNames)})
    ),
    first_lift AS (
      SELECT DISTINCT ON (exercise_name)
        exercise_name,
        weight_kg AS first_weight_kg,
        created_at AS first_lift_at
      FROM weighted
      ORDER BY exercise_name, session_date ASC, created_at ASC
    ),
    latest_lift AS (
      SELECT DISTINCT ON (exercise_name)
        exercise_name,
        weight_kg AS latest_weight_kg,
        created_at AS latest_lift_at
      FROM weighted
      ORDER BY exercise_name, session_date DESC, created_at DESC
    ),
    best_lift AS (
      SELECT DISTINCT ON (exercise_name)
        exercise_name,
        weight_kg AS best_weight_kg,
        created_at AS best_lift_at
      FROM weighted
      ORDER BY exercise_name, weight_kg DESC, session_date DESC, created_at DESC
    ),
    counts AS (
      SELECT
        exercise_name,
        COUNT(*) AS entry_count
      FROM weighted
      GROUP BY exercise_name
    )
    SELECT
      c.exercise_name,
      c.entry_count,
      f.first_weight_kg,
      l.latest_weight_kg,
      b.best_weight_kg,
      f.first_lift_at,
      l.latest_lift_at,
      b.best_lift_at
    FROM counts AS c
    INNER JOIN first_lift AS f ON f.exercise_name = c.exercise_name
    INNER JOIN latest_lift AS l ON l.exercise_name = c.exercise_name
    INNER JOIN best_lift AS b ON b.exercise_name = c.exercise_name
  `;

  for (const row of rows) {
    await tx.userExerciseStat.upsert({
      where: {
        userId_exerciseName: {
          userId,
          exerciseName: row.exercise_name,
        },
      },
      update: {
        entryCount: Number(row.entry_count),
        firstWeightKg: Number(row.first_weight_kg.toFixed(2)),
        latestWeightKg: Number(row.latest_weight_kg.toFixed(2)),
        bestWeightKg: Number(row.best_weight_kg.toFixed(2)),
        firstLiftAt: row.first_lift_at,
        latestLiftAt: row.latest_lift_at,
        bestLiftAt: row.best_lift_at,
      },
      create: {
        userId,
        exerciseName: row.exercise_name,
        entryCount: Number(row.entry_count),
        firstWeightKg: Number(row.first_weight_kg.toFixed(2)),
        latestWeightKg: Number(row.latest_weight_kg.toFixed(2)),
        bestWeightKg: Number(row.best_weight_kg.toFixed(2)),
        firstLiftAt: row.first_lift_at,
        latestLiftAt: row.latest_lift_at,
        bestLiftAt: row.best_lift_at,
      },
    });
  }
}

async function aggregateEntryExpBySkill(
  userId: string,
  entries: readonly WorkoutGamificationEntryInput[],
): Promise<Map<MuscleSkill, SkillExpAggregation>> {
  if (entries.length === 0) {
    return new Map();
  }

  const customExercises = await prisma.customExercise.findMany({
    where: { userId },
    select: {
      name: true,
      muscleGroup: true,
    },
  });

  const customByName = new Map<string, MuscleGroup>();
  for (const exercise of customExercises) {
    customByName.set(normalizeExerciseName(exercise.name), exercise.muscleGroup);
  }

  const aggregation = new Map<MuscleSkill, SkillExpAggregation>();

  for (const entry of entries) {
    const normalizedName = normalizeExerciseName(entry.exerciseName);
    const muscleGroup = customByName.get(normalizedName);
    const skill = muscleGroup
      ? resolveMuscleSkillFromGroup(muscleGroup, normalizedName)
      : resolveMuscleSkillByName(normalizedName);

    const baseExp = resolveEntryBaseExp(entry);
    const weightedExp = Number((baseExp * resolveRpeMultiplier(entry.rpe)).toFixed(2));

    const current = aggregation.get(skill) ?? { baseExp: 0, weightedExp: 0 };
    current.baseExp = Number((current.baseExp + baseExp).toFixed(2));
    current.weightedExp = Number((current.weightedExp + weightedExp).toFixed(2));
    aggregation.set(skill, current);
  }

  return aggregation;
}

async function applyMuscleExpGain(
  tx: Tx,
  userId: string,
  sessionId: string,
  isoWeek: string,
  skill: MuscleSkill,
  gain: SkillExpAggregation,
): Promise<{ awardedExpDelta: number; levelUpTo: number | null }> {
  if (gain.baseExp <= 0 || gain.weightedExp <= 0) {
    return {
      awardedExpDelta: 0,
      levelUpTo: null,
    };
  }

  const existingLedger = await tx.muscleExpLedger.findUnique({
    where: {
      sessionId_skill: {
        sessionId,
        skill,
      },
    },
  });

  let streakMultiplier = existingLedger?.streakMultiplier ?? 1;

  if (!existingLedger) {
    const previousSessionCountThisWeek = await tx.muscleExpLedger.count({
      where: {
        userId,
        skill,
        isoWeek,
        sessionId: {
          not: sessionId,
        },
      },
    });

    if (previousSessionCountThisWeek === 1) {
      streakMultiplier = SECOND_SESSION_WEEKLY_COMBO;
    }
  }

  const awardedExpDelta = Number((gain.weightedExp * streakMultiplier).toFixed(2));

  if (existingLedger) {
    const nextBaseExp = Number((existingLedger.baseExp + gain.baseExp).toFixed(2));
    const previousWeightedExp = existingLedger.baseExp * existingLedger.rpeMultiplier;
    const nextWeightedExp = previousWeightedExp + gain.weightedExp;
    const nextRpeMultiplier = nextBaseExp > 0
      ? Number((nextWeightedExp / nextBaseExp).toFixed(4))
      : 1;

    await tx.muscleExpLedger.update({
      where: { id: existingLedger.id },
      data: {
        baseExp: nextBaseExp,
        awardedExp: Number((existingLedger.awardedExp + awardedExpDelta).toFixed(2)),
        rpeMultiplier: nextRpeMultiplier,
      },
    });
  } else {
    await tx.muscleExpLedger.create({
      data: {
        userId,
        sessionId,
        skill,
        isoWeek,
        baseExp: gain.baseExp,
        rpeMultiplier: Number((gain.weightedExp / gain.baseExp).toFixed(4)),
        streakMultiplier,
        awardedExp: awardedExpDelta,
      },
    });
  }

  const currentProgress = await tx.muscleSkillProgress.findUnique({
    where: {
      userId_skill: {
        userId,
        skill,
      },
    },
  });

  const previousLevel = currentProgress?.level ?? 1;
  const nextTotalExp = Number(((currentProgress?.totalExp ?? 0) + awardedExpDelta).toFixed(2));
  const nextLevel = resolveLevelState(nextTotalExp).level;

  await tx.muscleSkillProgress.upsert({
    where: {
      userId_skill: {
        userId,
        skill,
      },
    },
    update: {
      totalExp: nextTotalExp,
      level: nextLevel,
    },
    create: {
      userId,
      skill,
      totalExp: nextTotalExp,
      level: nextLevel,
    },
  });

  return {
    awardedExpDelta,
    levelUpTo: nextLevel > previousLevel ? nextLevel : null,
  };
}

async function computeAchievementProgress(
  tx: Tx,
  userId: string,
  codes: ReadonlySet<AchievementCode>,
): Promise<Map<AchievementCode, number>> {
  const needsPersistedStats =
    codes.has(AchievementCode.VOLUME_SESSION_1000)
    || codes.has(AchievementCode.LIFETIME_VOLUME_5000000)
    || codes.has(AchievementCode.CLUB_100);
  const needsSessions =
    codes.has(AchievementCode.DAWN_WARRIOR)
    || codes.has(AchievementCode.STREAK_30_DAYS)
    || codes.has(AchievementCode.OPEN_APP_7_DAYS_NO_WORKOUT);
  const needsPrWeeks = codes.has(AchievementCode.PR_STREAK_3_IN_3_WEEKS);
  const needsRestAverage = codes.has(AchievementCode.REST_MONSTER);
  const needsAppOpenRows = codes.has(AchievementCode.OPEN_APP_7_DAYS_NO_WORKOUT);

  const [sessions, prWeeks, restAverageRows, appOpenRows, persistedStats] = await Promise.all([
    needsSessions
      ? tx.workoutSession.findMany({
          where: { userId },
          select: {
            sessionDate: true,
            startedAt: true,
            timezoneOffsetMinutes: true,
          },
          orderBy: {
            sessionDate: 'asc',
          },
        })
      : Promise.resolve([] as Array<{ sessionDate: Date; startedAt: Date; timezoneOffsetMinutes: number | null }>),
    needsPrWeeks
      ? tx.personalRecordEvent.findMany({
          where: { userId },
          select: {
            isoWeek: true,
          },
          distinct: ['isoWeek'],
          orderBy: {
            isoWeek: 'asc',
          },
        })
      : Promise.resolve([] as Array<{ isoWeek: string }>),
    needsRestAverage
      ? tx.$queryRaw<Array<{ max_avg_rest: number | null }>>`
          SELECT
            MAX(session_avg.avg_rest) AS max_avg_rest
          FROM (
            SELECT
              AVG(COALESCE(we."restSeconds", 0)) AS avg_rest
            FROM "WorkoutEntry" AS we
            INNER JOIN "WorkoutSession" AS ws ON ws."id" = we."sessionId"
            WHERE ws."userId" = ${userId}
            GROUP BY we."sessionId"
          ) AS session_avg
        `
      : Promise.resolve([] as Array<{ max_avg_rest: number | null }>),
    needsAppOpenRows
      ? tx.userDailyAppOpen.findMany({
          where: { userId },
          select: {
            activityDate: true,
          },
          orderBy: {
            activityDate: 'asc',
          },
        })
      : Promise.resolve([] as Array<{ activityDate: Date }>),
    needsPersistedStats
      ? tx.userGamificationStat.findUnique({
          where: { userId },
          select: {
            totalVolumeLifted: true,
            maxSessionVolume: true,
            maxWeightKg: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const lifetimeVolume = Number((persistedStats?.totalVolumeLifted ?? 0).toFixed(2));
  const maxSessionVolume = Number((persistedStats?.maxSessionVolume ?? 0).toFixed(2));

  const hasDawnSession = sessions.some((session) => {
    const minute = toSessionMinuteInLocalTime(session.startedAt, session.timezoneOffsetMinutes);
    return minute >= 270 && minute <= 360;
  });

  const workoutDateSet = new Set(sessions.map((session) => dateOnlyKey(session.sessionDate)));
  const workoutStreak = calculateLongestWorkoutStreak(sessions.map((session) => session.sessionDate));
  const prWeekStreak = calculatePrWeekStreak(prWeeks.map((entry) => entry.isoWeek));
  const maxWeightKg = Number((persistedStats?.maxWeightKg ?? 0).toFixed(2));
  const maxAverageRestSeconds = Number((restAverageRows[0]?.max_avg_rest ?? 0).toFixed(2));
  const noWorkoutOpenStreak = calculateNoWorkoutOpenStreak(
    appOpenRows.map((row) => row.activityDate),
    workoutDateSet,
  );

  const progress = new Map<AchievementCode, number>();
  if (codes.has(AchievementCode.VOLUME_SESSION_1000)) {
    progress.set(AchievementCode.VOLUME_SESSION_1000, maxSessionVolume);
  }
  if (codes.has(AchievementCode.LIFETIME_VOLUME_5000000)) {
    progress.set(AchievementCode.LIFETIME_VOLUME_5000000, lifetimeVolume);
  }
  if (codes.has(AchievementCode.DAWN_WARRIOR)) {
    progress.set(AchievementCode.DAWN_WARRIOR, hasDawnSession ? 1 : 0);
  }
  if (codes.has(AchievementCode.STREAK_30_DAYS)) {
    progress.set(AchievementCode.STREAK_30_DAYS, workoutStreak);
  }
  if (codes.has(AchievementCode.PR_STREAK_3_IN_3_WEEKS)) {
    progress.set(AchievementCode.PR_STREAK_3_IN_3_WEEKS, prWeekStreak);
  }
  if (codes.has(AchievementCode.CLUB_100)) {
    progress.set(AchievementCode.CLUB_100, maxWeightKg);
  }
  if (codes.has(AchievementCode.OPEN_APP_7_DAYS_NO_WORKOUT)) {
    progress.set(AchievementCode.OPEN_APP_7_DAYS_NO_WORKOUT, noWorkoutOpenStreak);
  }
  if (codes.has(AchievementCode.REST_MONSTER)) {
    progress.set(AchievementCode.REST_MONSTER, maxAverageRestSeconds);
  }

  return progress;
}

type UnlockedAchievementNotification = {
  title: string;
  message: string;
  code: AchievementCode;
  iconKey: string;
};

async function upsertLifetimeVolumeAchievement(
  tx: Tx,
  userId: string,
): Promise<UnlockedAchievementNotification | null> {
  const definition = ACHIEVEMENT_DEFINITIONS.find(
    (item) => item.code === AchievementCode.LIFETIME_VOLUME_5000000,
  );

  if (!definition) {
    return null;
  }

  const [stats, existing] = await Promise.all([
    tx.userGamificationStat.findUnique({
      where: { userId },
      select: {
        totalVolumeLifted: true,
      },
    }),
    tx.userAchievement.findUnique({
      where: {
        userId_code: {
          userId,
          code: AchievementCode.LIFETIME_VOLUME_5000000,
        },
      },
      select: {
        isUnlocked: true,
        unlockedAt: true,
      },
    }),
  ]);

  const progressValue = Number((stats?.totalVolumeLifted ?? 0).toFixed(2));
  const unlockedByProgress = progressValue >= definition.targetValue;
  const isUnlocked = Boolean(existing?.isUnlocked || unlockedByProgress);
  const unlockedAt = isUnlocked ? (existing?.unlockedAt ?? new Date()) : null;

  await tx.userAchievement.upsert({
    where: {
      userId_code: {
        userId,
        code: AchievementCode.LIFETIME_VOLUME_5000000,
      },
    },
    update: {
      progressValue,
      targetValue: definition.targetValue,
      isUnlocked,
      unlockedAt,
    },
    create: {
      userId,
      code: AchievementCode.LIFETIME_VOLUME_5000000,
      progressValue,
      targetValue: definition.targetValue,
      isUnlocked,
      unlockedAt,
    },
  });

  if (!existing?.isUnlocked && isUnlocked) {
    return {
      title: `Achievement Unlocked: ${definition.title}`,
      message: definition.description,
      code: definition.code,
      iconKey: definition.iconKey,
    };
  }

  return null;
}

async function upsertAchievements(
  tx: Tx,
  userId: string,
): Promise<UnlockedAchievementNotification[]> {
  const [existingRows, lifetimeUnlocked] = await Promise.all([
    tx.userAchievement.findMany({
      where: { userId },
    }),
    upsertLifetimeVolumeAchievement(tx, userId),
  ]);

  const existingByCode = new Map(existingRows.map((row) => [row.code, row]));
  const pendingCodes = new Set<AchievementCode>(
    ACHIEVEMENT_DEFINITIONS
      .filter((definition) => definition.code !== AchievementCode.LIFETIME_VOLUME_5000000)
      .filter((definition) => !existingByCode.get(definition.code)?.isUnlocked)
      .map((definition) => definition.code),
  );
  const progress = pendingCodes.size > 0
    ? await computeAchievementProgress(tx, userId, pendingCodes)
    : new Map<AchievementCode, number>();
  const now = new Date();
  const unlockedNotifications: UnlockedAchievementNotification[] = lifetimeUnlocked
    ? [lifetimeUnlocked]
    : [];

  for (const definition of ACHIEVEMENT_DEFINITIONS) {
    if (definition.code === AchievementCode.LIFETIME_VOLUME_5000000) {
      continue;
    }

    const existing = existingByCode.get(definition.code);

    if (existing?.isUnlocked) {
      if (existing.targetValue !== definition.targetValue) {
        await tx.userAchievement.update({
          where: { id: existing.id },
          data: {
            targetValue: definition.targetValue,
          },
        });
      }
      continue;
    }

    const progressValue = Number((progress.get(definition.code) ?? 0).toFixed(2));
    const isUnlocked = progressValue >= definition.targetValue;
    const unlockedAt = isUnlocked ? existing?.unlockedAt ?? now : null;

    if (!existing) {
      await tx.userAchievement.create({
        data: {
          userId,
          code: definition.code,
          progressValue,
          targetValue: definition.targetValue,
          isUnlocked,
          unlockedAt,
        },
      });

      if (isUnlocked) {
        unlockedNotifications.push({
          title: `Achievement Unlocked: ${definition.title}`,
          message: definition.description,
          code: definition.code,
          iconKey: definition.iconKey,
        });
      }

      continue;
    }

    const shouldUpdate =
      Math.abs(existing.progressValue - progressValue) > 0.005
      || existing.targetValue !== definition.targetValue
      || existing.isUnlocked !== isUnlocked;

    if (!shouldUpdate) {
      continue;
    }

    await tx.userAchievement.update({
      where: { id: existing.id },
      data: {
        progressValue,
        targetValue: definition.targetValue,
        isUnlocked,
        unlockedAt,
      },
    });

    if (!existing.isUnlocked && isUnlocked) {
      unlockedNotifications.push({
        title: `Achievement Unlocked: ${definition.title}`,
        message: definition.description,
        code: definition.code,
        iconKey: definition.iconKey,
      });
    }
  }

  if (unlockedNotifications.length > 0) {
    await tx.gamificationNotification.createMany({
      data: unlockedNotifications.map((item) => ({
        userId,
        type: GamificationNotificationType.ACHIEVEMENT_UNLOCKED,
        title: item.title,
        message: item.message,
        payload: {
          code: item.code,
          iconKey: item.iconKey,
        },
      })),
    });
  }

  return unlockedNotifications;
}

export async function processWorkoutGamificationJob(payload: GamificationJobPayload): Promise<void> {
  if (!payload.entries.length) {
    return;
  }

  const expBySkill = await aggregateEntryExpBySkill(payload.userId, payload.entries);
  const isoWeek = toIsoWeek(payload.sessionDate);

  const transactionResult = await prisma.$transaction(async (tx) => {
    const existingRun = await tx.gamificationJobRun.findUnique({
      where: {
        jobKey: payload.jobKey,
      },
      select: {
        id: true,
      },
    });

    if (existingRun) {
      return {
        skipped: true,
        levelUps: [] as Array<{ skill: MuscleSkill; level: number; title: string; message: string }>,
      };
    }

    await tx.gamificationJobRun.create({
      data: {
        userId: payload.userId,
        sessionId: payload.sessionId,
        jobKey: payload.jobKey,
      },
    });

    if (userExerciseStatTableAvailable !== false) {
      try {
        await refreshUserExerciseStatsForSession(tx, payload.userId, payload.sessionId);
        userExerciseStatTableAvailable = true;
      } catch (error) {
        if (!isMissingUserExerciseStatTable(error)) {
          throw error;
        }

        userExerciseStatTableAvailable = false;
      }
    }

    const levelUps: Array<{ skill: MuscleSkill; level: number; title: string; message: string }> = [];

    for (const [skill, gain] of expBySkill) {
      const result = await applyMuscleExpGain(tx, payload.userId, payload.sessionId, isoWeek, skill, gain);

      if (!result.levelUpTo) {
        continue;
      }

      levelUps.push({
        skill,
        level: result.levelUpTo,
        title: `${MUSCLE_SKILL_LABEL[skill]} reached Level ${result.levelUpTo}`,
        message: `Your ${MUSCLE_SKILL_LABEL[skill]} skill tree has leveled up to ${result.levelUpTo}.`,
      });
    }

    if (levelUps.length > 0) {
      await tx.gamificationNotification.createMany({
        data: levelUps.map((item) => ({
          userId: payload.userId,
          type: GamificationNotificationType.MUSCLE_LEVEL_UP,
          title: item.title,
          message: item.message,
          payload: {
            skill: item.skill,
            level: item.level,
          },
        })),
      });
    }

    return {
      skipped: false,
      levelUps,
    };
  });

  if (transactionResult.skipped) {
    return;
  }

  const unlockedAchievements = await prisma.$transaction(async (tx) => upsertAchievements(tx, payload.userId));

  const realtimePublishes = [
    ...transactionResult.levelUps.map((item) =>
      publishGamificationRealtimeEvent({
        type: 'muscle:levelup',
        userId: payload.userId,
        payload: {
          skill: item.skill,
          level: item.level,
          title: item.title,
          message: item.message,
        },
      })),
    ...unlockedAchievements.map((item) =>
      publishGamificationRealtimeEvent({
        type: 'achievement:unlocked',
        userId: payload.userId,
        payload: {
          code: item.code,
          title: item.title,
          message: item.message,
          iconKey: item.iconKey,
        },
      })),
  ];

  if (realtimePublishes.length > 0) {
    await Promise.allSettled(realtimePublishes);
  }

  invalidateCacheNamespace(cacheNamespaces.dashboardOverview);
  invalidateCacheKey(cacheNamespaces.gamificationProfile, toProfileCacheKey(payload.userId));
}

export async function runWorkoutGamificationPipeline(userId: string, payload: WorkoutGamificationPayload): Promise<void> {
  await processWorkoutGamificationJob({
    ...payload,
    userId,
    jobKey: `legacy:${payload.sessionId}:${Date.now()}:${crypto.randomUUID()}`,
  });
}

export async function recordDailyAppOpen(userId: string, at: Date = new Date()): Promise<void> {
  const activityDate = dateOnlyUtc(at);

  await prisma.$transaction(async (tx) => {
    await tx.userDailyAppOpen.upsert({
      where: {
        userId_activityDate: {
          userId,
          activityDate,
        },
      },
      update: {},
      create: {
        userId,
        activityDate,
      },
    });
  });

  const unlockedAchievements = await prisma.$transaction(async (tx) => upsertAchievements(tx, userId));

  if (unlockedAchievements.length > 0) {
    await Promise.allSettled(
      unlockedAchievements.map((item) =>
        publishGamificationRealtimeEvent({
          type: 'achievement:unlocked',
          userId,
          payload: {
            code: item.code,
            title: item.title,
            message: item.message,
            iconKey: item.iconKey,
          },
        })),
    );
  }

  invalidateCacheKey(cacheNamespaces.gamificationProfile, toProfileCacheKey(userId));
}

export async function getGamificationProfile(userId: string) {
  return readThroughCache(
    cacheNamespaces.gamificationProfile,
    toProfileCacheKey(userId),
    GAMIFICATION_PROFILE_TTL_MS,
    async () => {
      const [skills, achievementRows, unreadNotificationCount] = await prisma.$transaction([
        prisma.muscleSkillProgress.findMany({
          where: { userId },
        }),
        prisma.userAchievement.findMany({
          where: { userId },
        }),
        prisma.gamificationNotification.count({
          where: {
            userId,
            readAt: null,
          },
        }),
      ]);

      const skillByCode = new Map(skills.map((row) => [row.skill, row]));

      const skillRows = MUSCLE_SKILL_ORDER.map((skill) => {
        const row = skillByCode.get(skill);
        const totalExp = Number((row?.totalExp ?? 0).toFixed(2));
        const levelState = resolveLevelState(totalExp);

        return {
          skill,
          label: MUSCLE_SKILL_LABEL[skill],
          totalExp,
          level: levelState.level,
          expIntoLevel: levelState.expIntoLevel,
          expToNextLevel: levelState.expForNextLevel,
          progressPct: levelState.progressPct,
          powerScore: Number((levelState.level + levelState.progressPct / 100).toFixed(2)),
        };
      });

      const maxPowerScore = Math.max(...skillRows.map((row) => row.powerScore), 1);

      const radar = skillRows.map((row) => ({
        muscle: row.label,
        skill: row.skill,
        value: Number(((row.powerScore / maxPowerScore) * 100).toFixed(2)),
        level: row.level,
      }));

      const achievementByCode = new Map(achievementRows.map((row) => [row.code, row]));

      const achievements = ACHIEVEMENT_DEFINITIONS.map((definition) => {
        const row = achievementByCode.get(definition.code);
        const isUnlocked = row?.isUnlocked ?? false;
        const progressValue = Number((row?.progressValue ?? 0).toFixed(2));
        const targetValue = definition.targetValue;
        const progressPct = targetValue > 0
          ? Number(Math.min((progressValue / targetValue) * 100, 100).toFixed(2))
          : 0;

        return {
          code: definition.code,
          category: definition.category,
          isHidden: definition.hidden,
          isUnlocked,
          title: !isUnlocked && definition.hidden ? 'Hidden Achievement' : definition.title,
          description: !isUnlocked && definition.hidden
            ? 'Keep training and exploring to reveal this badge.'
            : definition.description,
          progressValue,
          targetValue,
          progressPct,
          progressUnit: definition.progressUnit,
          iconKey: definition.iconKey,
          unlockedAt: row?.unlockedAt ?? null,
        };
      });

      const unlockedCount = achievements.filter((item) => item.isUnlocked).length;

      return {
        muscleSkills: skillRows.map(({ powerScore, ...skill }) => skill),
        radar,
        achievements,
        summary: {
          unlockedAchievements: unlockedCount,
          totalAchievements: achievements.length,
          unreadNotifications: unreadNotificationCount,
        },
      };
    },
  );
}

export async function consumeGamificationNotifications(
  userId: string,
  limit = 10,
): Promise<GamificationNotificationItem[]> {
  const effectiveLimit = Math.max(MIN_NOTIFICATION_BATCH, Math.min(MAX_NOTIFICATION_BATCH, Math.floor(limit)));

  const notifications = await prisma.$transaction(async (tx) => {
    const unread = await tx.gamificationNotification.findMany({
      where: {
        userId,
        readAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: effectiveLimit,
    });

    if (unread.length > 0) {
      await tx.gamificationNotification.updateMany({
        where: {
          id: {
            in: unread.map((item) => item.id),
          },
        },
        data: {
          readAt: new Date(),
        },
      });
    }

    return unread;
  });

  if (notifications.length > 0) {
    invalidateCacheKey(cacheNamespaces.gamificationProfile, toProfileCacheKey(userId));
  }

  return notifications.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    message: item.message,
    payload: toJsonPayload(item.payload),
    createdAt: item.createdAt,
  }));
}
