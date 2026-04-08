import { deserialize, serialize } from 'node:v8';

import { env } from '../config/env.js';
import { getRedisClient } from './redis.js';

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

type RedisEnvelope = {
  value: unknown;
};

const valueStore = new Map<string, CacheEntry>();
const inFlightStore = new Map<string, Promise<unknown>>();
const namespaceVersions = new Map<string, number>();

const REDIS_NAMESPACE_VERSION_PREFIX = 'cache:nsv:';
const REDIS_DATA_PREFIX = 'cache:data:';

export const cacheNamespaces = {
  dashboardOverview: 'dashboard:overview',
  progressOverview: 'progress:overview',
  progressExercise: 'progress:exercise',
  workoutAnalytics: 'workout:analytics',
  workoutHistory: 'workout:history',
  workoutPrs: 'workout:prs',
  workoutSuggestion: 'workout:suggestion',
  bodyMetricHistory: 'body-metrics:history',
  bodyMetricLatest: 'body-metrics:latest',
} as const;

function toVersionedKey(namespace: string, version: number, key: string): string {
  return `${namespace}#${version}#${key}`;
}

function toRedisKey(rawKey: string): string {
  return `${env.REDIS_KEY_PREFIX}${rawKey}`;
}

function encodeRedisEnvelope(value: unknown): string {
  const payload: RedisEnvelope = { value };
  return serialize(payload).toString('base64');
}

function decodeRedisEnvelope(encoded: string): RedisEnvelope | null {
  try {
    const payload = deserialize(Buffer.from(encoded, 'base64')) as RedisEnvelope;
    if (!payload || typeof payload !== 'object' || !('value' in payload)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function getNamespaceVersion(namespace: string): Promise<number> {
  const localVersion = namespaceVersions.get(namespace) ?? 0;
  const client = await getRedisClient();

  if (!client) {
    return localVersion;
  }

  try {
    const raw = await client.get(toRedisKey(`${REDIS_NAMESPACE_VERSION_PREFIX}${namespace}`));
    const parsed = Number.parseInt(raw ?? '0', 10);
    const redisVersion = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    const mergedVersion = Math.max(localVersion, redisVersion);
    namespaceVersions.set(namespace, mergedVersion);
    return mergedVersion;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[cache] namespace version read failed', error);
    return localVersion;
  }
}

async function readRedisCacheValue<T>(versionedKey: string): Promise<{ hit: boolean; value?: T }> {
  const client = await getRedisClient();
  if (!client) {
    return { hit: false };
  }

  try {
    const encoded = await client.get(toRedisKey(`${REDIS_DATA_PREFIX}${versionedKey}`));
    if (!encoded) {
      return { hit: false };
    }

    const envelope = decodeRedisEnvelope(encoded);
    if (!envelope) {
      return { hit: false };
    }

    return {
      hit: true,
      value: envelope.value as T,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[cache] redis read failed', error);
    return { hit: false };
  }
}

function writeRedisCacheValue(versionedKey: string, value: unknown, ttlMs: number): void {
  if (ttlMs <= 0) {
    return;
  }

  void (async () => {
    const client = await getRedisClient();
    if (!client) {
      return;
    }

    try {
      await client.set(toRedisKey(`${REDIS_DATA_PREFIX}${versionedKey}`), encodeRedisEnvelope(value), {
        PX: ttlMs,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[cache] redis write failed', error);
    }
  })();
}

function bumpNamespaceVersion(namespace: string): number {
  const nextVersion = (namespaceVersions.get(namespace) ?? 0) + 1;
  namespaceVersions.set(namespace, nextVersion);
  return nextVersion;
}

function bumpNamespaceVersionInRedis(namespace: string): void {
  void (async () => {
    const client = await getRedisClient();
    if (!client) {
      return;
    }

    try {
      const version = await client.incr(toRedisKey(`${REDIS_NAMESPACE_VERSION_PREFIX}${namespace}`));
      namespaceVersions.set(namespace, Math.max(namespaceVersions.get(namespace) ?? 0, Number(version)));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[cache] namespace version bump failed', error);
    }
  })();
}

export function serializeCacheKey(
  parts: ReadonlyArray<string | number | boolean | null | undefined>,
): string {
  return JSON.stringify(parts);
}

export async function readThroughCache<T>(
  namespace: string,
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  if (ttlMs <= 0) {
    return loader();
  }

  const namespaceVersion = await getNamespaceVersion(namespace);
  const versionedKey = toVersionedKey(namespace, namespaceVersion, key);
  const now = Date.now();

  const cached = valueStore.get(versionedKey);
  if (cached) {
    if (cached.expiresAt > now) {
      return cached.value as T;
    }

    valueStore.delete(versionedKey);
  }

  const inFlight = inFlightStore.get(versionedKey);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const redisCached = await readRedisCacheValue<T>(versionedKey);
  if (redisCached.hit) {
    valueStore.set(versionedKey, {
      value: redisCached.value,
      expiresAt: now + ttlMs,
    });

    return redisCached.value as T;
  }

  const loadPromise = loader()
    .then((value) => {
      if ((namespaceVersions.get(namespace) ?? namespaceVersion) === namespaceVersion) {
        valueStore.set(versionedKey, {
          value,
          expiresAt: Date.now() + ttlMs,
        });

        writeRedisCacheValue(versionedKey, value, ttlMs);
      }

      return value;
    })
    .finally(() => {
      inFlightStore.delete(versionedKey);
    });

  inFlightStore.set(versionedKey, loadPromise as Promise<unknown>);
  return loadPromise;
}

export function invalidateCacheNamespace(namespace: string): void {
  bumpNamespaceVersion(namespace);
  bumpNamespaceVersionInRedis(namespace);

  const namespacePrefix = `${namespace}#`;

  for (const key of valueStore.keys()) {
    if (key.startsWith(namespacePrefix)) {
      valueStore.delete(key);
    }
  }

  for (const key of inFlightStore.keys()) {
    if (key.startsWith(namespacePrefix)) {
      inFlightStore.delete(key);
    }
  }
}

export function invalidateCacheNamespaces(namespaces: readonly string[]): void {
  const uniqueNamespaces = new Set(namespaces);
  for (const namespace of uniqueNamespaces) {
    invalidateCacheNamespace(namespace);
  }
}
