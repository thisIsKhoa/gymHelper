import { prisma } from '../../db/prisma.js';
import {
  cacheNamespaces,
  invalidateCacheNamespace,
  invalidateCacheKeys,
  readThroughCache,
  serializeCacheKey,
} from '../../utils/cache.js';
import type { BodyMetricHistoryQueryInput, CreateBodyMetricInput } from './body-metrics.schemas.js';

const BODY_METRIC_HISTORY_TTL_MS = 30_000;
const BODY_METRIC_LATEST_TTL_MS = 30_000;
const BODY_METRIC_HISTORY_DEFAULT_LIMIT = 30;

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
      namespace: cacheNamespaces.bodyMetricLatest,
      key: serializeCacheKey([userId]),
    },
  ]);
  invalidateCacheNamespace(cacheNamespaces.bodyMetricHistory);

  return metric;
}

export async function getBodyMetricHistory(userId: string, query: BodyMetricHistoryQueryInput = {}) {
  const effectiveLimit = query.limit ?? BODY_METRIC_HISTORY_DEFAULT_LIMIT;
  const effectiveOffset = query.offset ?? 0;

  return readThroughCache(
    cacheNamespaces.bodyMetricHistory,
    serializeCacheKey([
      userId,
      query.from?.toISOString() ?? null,
      query.to?.toISOString() ?? null,
      effectiveLimit,
      effectiveOffset,
    ]),
    BODY_METRIC_HISTORY_TTL_MS,
    async () => {
      const rows = await prisma.bodyMetric.findMany({
        where: {
          userId,
          ...(query.from || query.to
            ? {
                loggedAt: {
                  gte: query.from,
                  lte: query.to,
                },
              }
            : {}),
        },
        orderBy: [{ loggedAt: 'desc' }, { createdAt: 'desc' }],
        skip: effectiveOffset,
        take: effectiveLimit + 1,
      });

      const hasMore = rows.length > effectiveLimit;
      const items = hasMore ? rows.slice(0, effectiveLimit) : rows;

      return {
        items,
        pagination: {
          limit: effectiveLimit,
          offset: effectiveOffset,
          hasMore,
          nextOffset: hasMore ? effectiveOffset + effectiveLimit : null,
        },
      };
    },
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
