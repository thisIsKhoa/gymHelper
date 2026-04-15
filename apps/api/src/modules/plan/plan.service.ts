import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type { CreatePlanInput, UpdatePlanInput } from './plan.schemas.js';

interface SessionPlanExercise {
  exerciseName: string;
  sets: number;
  reps: number;
  targetWeightKg?: number;
  restSeconds?: number;
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function normalizeOptionalPositiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toSessionPlanExercises(rawExercises: Prisma.JsonValue): SessionPlanExercise[] {
  if (!Array.isArray(rawExercises)) {
    return [];
  }

  const exercises: SessionPlanExercise[] = [];

  for (const item of rawExercises) {
    // Legacy plans may store exercises as plain string names.
    if (typeof item === 'string') {
      const exerciseName = item.trim();
      if (exerciseName) {
        exercises.push({
          exerciseName,
          sets: 4,
          reps: 8,
        });
      }
      continue;
    }

    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const exerciseNameValue =
      typeof record.exerciseName === 'string'
        ? record.exerciseName
        : typeof record.name === 'string'
          ? record.name
          : typeof record.title === 'string'
            ? record.title
            : '';

    const exerciseName = exerciseNameValue.trim();
    if (!exerciseName) {
      continue;
    }

    const sets = normalizePositiveInt(record.sets, 4);
    const reps = normalizePositiveInt(record.reps, 8);
    const targetWeightKg = normalizeOptionalNumber(record.targetWeightKg ?? record.weightKg);
    const restSeconds = normalizeOptionalPositiveInt(record.restSeconds);

    exercises.push({
      exerciseName,
      sets,
      reps,
      targetWeightKg,
      restSeconds,
    });
  }

  return exercises;
}

function toPlanDayOfWeek(date: Date): number {
  // Monday=1 ... Sunday=7
  return ((date.getDay() + 6) % 7) + 1;
}

export async function createTrainingPlan(userId: string, input: CreatePlanInput) {
  return prisma.trainingPlan.create({
    data: {
      userId,
      name: input.name,
      description: normalizeOptionalText(input.description),
      goal: input.goal ?? 'MUSCLE_GAIN',
      level: input.level ?? 'INTERMEDIATE',
      days: {
        create: input.days.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          focus: day.focus,
          exercises: day.exercises,
        })),
      },
    },
    include: {
      days: {
        orderBy: { dayOfWeek: 'asc' },
      },
    },
  });
}

export async function listTrainingPlans(userId: string) {
  return prisma.trainingPlan.findMany({
    where: { userId },
    include: {
      days: {
        orderBy: { dayOfWeek: 'asc' },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function updateTrainingPlan(userId: string, planId: string, input: UpdatePlanInput) {
  const existing = await prisma.trainingPlan.findUnique({
    where: { id: planId },
  });

  if (!existing || existing.userId !== userId) {
    throw new HttpError(404, 'Training plan not found');
  }

  return prisma.$transaction(async (tx) => {
    await tx.trainingPlan.update({
      where: { id: planId },
      data: {
        name: input.name,
        description: normalizeOptionalText(input.description),
      },
    });

    await tx.trainingPlanDay.deleteMany({
      where: { planId },
    });

    await tx.trainingPlanDay.createMany({
      data: input.days.map((day) => ({
        planId,
        dayOfWeek: day.dayOfWeek,
        focus: day.focus,
        exercises: day.exercises,
      })),
    });

    return tx.trainingPlan.findUnique({
      where: { id: planId },
      include: {
        days: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });
  });
}

export async function duplicateTrainingPlan(userId: string, planId: string, name?: string) {
  const existing = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    include: {
      days: {
        orderBy: { dayOfWeek: 'asc' },
      },
    },
  });

  if (!existing || existing.userId !== userId) {
    throw new HttpError(404, 'Training plan not found');
  }

  return prisma.trainingPlan.create({
    data: {
      userId,
      name: name ?? `${existing.name} (Copy)`,
      description: existing.description,
      goal: existing.goal,
      level: existing.level,
      days: {
        create: existing.days.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          focus: day.focus,
          exercises: day.exercises as Prisma.InputJsonValue,
        })),
      },
    },
    include: {
      days: {
        orderBy: { dayOfWeek: 'asc' },
      },
    },
  });
}

export async function getSessionPlanTemplate(
  userId: string,
  date = new Date(),
  planId?: string,
) {
  const dayOfWeek = toPlanDayOfWeek(date);

  if (planId) {
    const selectedPlan = await prisma.trainingPlan.findFirst({
      where: {
        id: planId,
        userId,
      },
      include: {
        days: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    if (!selectedPlan) {
      return null;
    }

    const selectedDay =
      selectedPlan.days.find((day) => day.dayOfWeek === dayOfWeek) ?? selectedPlan.days[0];

    if (!selectedDay) {
      return null;
    }

    return {
      date: date.toISOString().slice(0, 10),
      dayOfWeek: selectedDay.dayOfWeek,
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      focus: selectedDay.focus,
      exercises: toSessionPlanExercises(selectedDay.exercises as Prisma.JsonValue),
    };
  }

  const plan = await prisma.trainingPlan.findFirst({
    where: {
      userId,
      days: {
        some: {
          dayOfWeek,
        },
      },
    },
    include: {
      days: {
        where: { dayOfWeek },
        take: 1,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const todayPlan = plan?.days[0];
  if (!plan || !todayPlan) {
    return null;
  }

  return {
    date: date.toISOString().slice(0, 10),
    dayOfWeek,
    planId: plan.id,
    planName: plan.name,
    focus: todayPlan.focus,
    exercises: toSessionPlanExercises(todayPlan.exercises as Prisma.JsonValue),
  };
}
