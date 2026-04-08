import { prisma } from '../../db/prisma.js';
import {
  cacheNamespaces,
  invalidateCacheKeys,
  readThroughCache,
  serializeCacheKey,
} from '../../utils/cache.js';
import type { CreateBodyMetricInput } from './body-metrics.schemas.js';

const BODY_METRIC_HISTORY_TTL_MS = 30_000;
const BODY_METRIC_LATEST_TTL_MS = 30_000;

export async function createBodyMetric(userId: string, input: CreateBodyMetricInput) {
  const metric = await prisma.bodyMetric.create({
    data: {
      userId,
      loggedAt: input.loggedAt ?? new Date(),
      weightKg: input.weightKg,
      bodyFatPct: input.bodyFatPct,
      muscleMassKg: input.muscleMassKg,
      notes: input.notes,
    },
  });

  invalidateCacheKeys([
    {
      namespace: cacheNamespaces.dashboardOverview,
      key: serializeCacheKey([userId]),
    },
    {
      namespace: cacheNamespaces.bodyMetricHistory,
      key: serializeCacheKey([userId, null, null]),
    },
    {
      namespace: cacheNamespaces.bodyMetricLatest,
      key: serializeCacheKey([userId]),
    },
  ]);

  return metric;
}

export async function getBodyMetricHistory(userId: string, from?: Date, to?: Date) {
  return readThroughCache(
    cacheNamespaces.bodyMetricHistory,
    serializeCacheKey([userId, from?.toISOString() ?? null, to?.toISOString() ?? null]),
    BODY_METRIC_HISTORY_TTL_MS,
    async () =>
      prisma.bodyMetric.findMany({
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
      }),
  );
}

export async function getLatestBodyMetric(userId: string) {
  return readThroughCache(
    cacheNamespaces.bodyMetricLatest,
    serializeCacheKey([userId]),
    BODY_METRIC_LATEST_TTL_MS,
    async () =>
      prisma.bodyMetric.findFirst({
        where: { userId },
        orderBy: {
          loggedAt: 'desc',
        },
      }),
  );
}
