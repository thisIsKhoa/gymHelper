import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type { CreatePlanInput, UpdatePlanInput } from './plan.schemas.js';

export async function createTrainingPlan(userId: string, input: CreatePlanInput) {
  return prisma.trainingPlan.create({
    data: {
      userId,
      name: input.name,
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
