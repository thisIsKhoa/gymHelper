import { prisma } from '../../db/prisma.js';
import {
  cacheNamespaces,
  invalidateCacheNamespace,
  invalidateCacheKeys,
  readThroughCache,
  serializeCacheKey,
} from '../../utils/cache.js';
import { HttpError } from '../../utils/http-error.js';
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

  invalidateCacheNamespace(cacheNamespaces.dashboardOverview);

  invalidateCacheKeys([
    {
      namespace: cacheNamespaces.bodyMetricLatest,
      key: serializeCacheKey([userId]),
    },
    {
      namespace: cacheNamespaces.bodyMetricHistory,
      key: serializeCacheKey([
        userId,
        null,
        null,
        BODY_METRIC_HISTORY_DEFAULT_LIMIT,
        null,
        0,
      ]),
    },
  ]);

  return metric;
}

export async function getBodyMetricHistory(userId: string, query: BodyMetricHistoryQueryInput = {}) {
  const effectiveLimit = query.limit ?? BODY_METRIC_HISTORY_DEFAULT_LIMIT;
  const effectiveCursor = query.cursor ?? null;
  const effectiveOffset = effectiveCursor ? 0 : (query.offset ?? 0);

  const loggedAtFilter = query.from || query.to
    ? {
        loggedAt: {
          gte: query.from,
          lte: query.to,
        },
      }
    : {};

  return readThroughCache(
    cacheNamespaces.bodyMetricHistory,
    serializeCacheKey([
      userId,
      query.from?.toISOString() ?? null,
      query.to?.toISOString() ?? null,
      effectiveLimit,
      effectiveCursor,
      effectiveOffset,
    ]),
    BODY_METRIC_HISTORY_TTL_MS,
    async () => {
      if (effectiveCursor) {
        const cursorRow = await prisma.bodyMetric.findFirst({
          where: {
            id: effectiveCursor,
            userId,
            ...loggedAtFilter,
          },
          select: {
            id: true,
          },
        });

        if (!cursorRow) {
          throw new HttpError(400, 'Invalid body metric history cursor');
        }
      }

      const rows = await prisma.bodyMetric.findMany({
        where: {
          userId,
          ...loggedAtFilter,
        },
        select: {
          id: true,
          loggedAt: true,
          weightKg: true,
          bodyFatPct: true,
          muscleMassKg: true,
          notes: true,
        },
        orderBy: [{ loggedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        ...(effectiveCursor
          ? {
              cursor: {
                id: effectiveCursor,
              },
              skip: 1,
            }
          : {
              skip: effectiveOffset,
            }),
        take: effectiveLimit + 1,
      });

      const hasMore = rows.length > effectiveLimit;
      const items = hasMore ? rows.slice(0, effectiveLimit) : rows;
      const nextCursor = hasMore ? (items.at(-1)?.id ?? null) : null;

      return {
        items,
        pagination: {
          limit: effectiveLimit,
          cursor: effectiveCursor,
          offset: effectiveOffset,
          hasMore,
          nextCursor,
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
        select: {
          id: true,
          loggedAt: true,
          weightKg: true,
          bodyFatPct: true,
          muscleMassKg: true,
          notes: true,
        },
        orderBy: {
          loggedAt: 'desc',
        },
      }),
  );
}
