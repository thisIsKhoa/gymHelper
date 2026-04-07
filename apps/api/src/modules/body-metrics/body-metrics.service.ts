import { prisma } from '../../db/prisma.js';
import type { CreateBodyMetricInput } from './body-metrics.schemas.js';

export async function createBodyMetric(userId: string, input: CreateBodyMetricInput) {
  return prisma.bodyMetric.create({
    data: {
      userId,
      loggedAt: input.loggedAt ?? new Date(),
      weightKg: input.weightKg,
      bodyFatPct: input.bodyFatPct,
      muscleMassKg: input.muscleMassKg,
      notes: input.notes,
    },
  });
}

export async function getBodyMetricHistory(userId: string, from?: Date, to?: Date) {
  return prisma.bodyMetric.findMany({
    where: {
      userId,
      loggedAt: {
        gte: from,
        lte: to,
      },
    },
    orderBy: {
      loggedAt: 'asc',
    },
  });
}

export async function getLatestBodyMetric(userId: string) {
  return prisma.bodyMetric.findFirst({
    where: { userId },
    orderBy: {
      loggedAt: 'desc',
    },
  });
}
