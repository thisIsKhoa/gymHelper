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

type CacheVersionState = {
  namespaceVersion: number;
  cacheKeyVersion: number;
};

type CacheEntryRef = {
  namespace: string;
  key: string;
};

const valueStore = new Map<string, CacheEntry>();
const inFlightStore = new Map<string, Promise<unknown>>();
const namespaceVersions = new Map<string, number>();
const cacheKeyVersions = new Map<string, number>();

const REDIS_NAMESPACE_VERSION_PREFIX = 'cache:nsv:';
const REDIS_CACHE_KEY_VERSION_PREFIX = 'cache:ckv:';
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

function toCacheKeyVersionMapKey(namespace: string, key: string): string {
  return `${namespace}::${key}`;
}

function toVersionedKey(
  namespace: string,
  namespaceVersion: number,
  cacheKeyVersion: number,
  key: string,
): string {
  return `${namespace}#${namespaceVersion}#${cacheKeyVersion}#${key}`;
}

function toRedisKey(rawKey: string): string {
  return `${env.REDIS_KEY_PREFIX}${rawKey}`;
}

function encodeRedisKeyPart(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function toRedisNamespaceVersionKey(namespace: string): string {
  return `${REDIS_NAMESPACE_VERSION_PREFIX}${namespace}`;
}

function toRedisCacheKeyVersionKey(namespace: string, key: string): string {
  return `${REDIS_CACHE_KEY_VERSION_PREFIX}${namespace}:${encodeRedisKeyPart(key)}`;
}

function toRedisDataKey(versionedKey: string): string {
  return `${REDIS_DATA_PREFIX}${versionedKey}`;
}

function parseVersion(raw: string | null | undefined): number {
  const parsed = Number.parseInt(raw ?? '0', 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
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

async function getCacheVersionState(namespace: string, key: string): Promise<CacheVersionState> {
  const localVersion = namespaceVersions.get(namespace) ?? 0;
  const cacheKeyVersionMapKey = toCacheKeyVersionMapKey(namespace, key);
  const localCacheKeyVersion = cacheKeyVersions.get(cacheKeyVersionMapKey) ?? 0;
  const client = await getRedisClient();

  if (!client) {
    return {
      namespaceVersion: localVersion,
      cacheKeyVersion: localCacheKeyVersion,
    };
  }

  try {
    const [namespaceRaw, cacheKeyRaw] = await client.mGet([
      toRedisKey(toRedisNamespaceVersionKey(namespace)),
      toRedisKey(toRedisCacheKeyVersionKey(namespace, key)),
    ]);

    const namespaceVersion = Math.max(localVersion, parseVersion(namespaceRaw));
    const cacheKeyVersion = Math.max(localCacheKeyVersion, parseVersion(cacheKeyRaw));

    namespaceVersions.set(namespace, namespaceVersion);
    cacheKeyVersions.set(cacheKeyVersionMapKey, cacheKeyVersion);

    return {
      namespaceVersion,
      cacheKeyVersion,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[cache] version read failed', error);
    return {
      namespaceVersion: localVersion,
      cacheKeyVersion: localCacheKeyVersion,
    };
  }
}

async function readRedisCacheValue<T>(versionedKey: string): Promise<{ hit: boolean; value?: T }> {
  const client = await getRedisClient();
  if (!client) {
    return { hit: false };
  }

  try {
    const encoded = await client.get(toRedisKey(toRedisDataKey(versionedKey)));
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
      await client.set(toRedisKey(toRedisDataKey(versionedKey)), encodeRedisEnvelope(value), {
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

function bumpCacheKeyVersion(namespace: string, key: string): number {
  const mapKey = toCacheKeyVersionMapKey(namespace, key);
  const nextVersion = (cacheKeyVersions.get(mapKey) ?? 0) + 1;
  cacheKeyVersions.set(mapKey, nextVersion);
  return nextVersion;
}

function bumpNamespaceVersionInRedis(namespace: string): void {
  void (async () => {
    const client = await getRedisClient();
    if (!client) {
      return;
    }

    try {
      const version = await client.incr(toRedisKey(toRedisNamespaceVersionKey(namespace)));
      namespaceVersions.set(namespace, Math.max(namespaceVersions.get(namespace) ?? 0, Number(version)));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[cache] namespace version bump failed', error);
    }
  })();
}

function bumpCacheKeyVersionInRedis(namespace: string, key: string): void {
  void (async () => {
    const client = await getRedisClient();
    if (!client) {
      return;
    }

    try {
      const version = await client.incr(toRedisKey(toRedisCacheKeyVersionKey(namespace, key)));
      const mapKey = toCacheKeyVersionMapKey(namespace, key);
      cacheKeyVersions.set(mapKey, Math.max(cacheKeyVersions.get(mapKey) ?? 0, Number(version)));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[cache] key version bump failed', error);
    }
  })();
}

function clearLocalNamespaceCache(namespace: string): void {
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

function clearLocalCacheEntry(namespace: string, key: string): void {
  const namespacePrefix = `${namespace}#`;
  const entrySuffix = `#${key}`;

  for (const cachedKey of valueStore.keys()) {
    if (cachedKey.startsWith(namespacePrefix) && cachedKey.endsWith(entrySuffix)) {
      valueStore.delete(cachedKey);
    }
  }

  for (const inFlightKey of inFlightStore.keys()) {
    if (inFlightKey.startsWith(namespacePrefix) && inFlightKey.endsWith(entrySuffix)) {
      inFlightStore.delete(inFlightKey);
    }
  }
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

  const { namespaceVersion, cacheKeyVersion } = await getCacheVersionState(namespace, key);
  const cacheKeyVersionMapKey = toCacheKeyVersionMapKey(namespace, key);
  const versionedKey = toVersionedKey(namespace, namespaceVersion, cacheKeyVersion, key);
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
      if (
        (namespaceVersions.get(namespace) ?? namespaceVersion) === namespaceVersion
        && (cacheKeyVersions.get(cacheKeyVersionMapKey) ?? cacheKeyVersion) === cacheKeyVersion
      ) {
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

  clearLocalNamespaceCache(namespace);
}

export function invalidateCacheKey(namespace: string, key: string): void {
  bumpCacheKeyVersion(namespace, key);
  bumpCacheKeyVersionInRedis(namespace, key);

  clearLocalCacheEntry(namespace, key);
}

export function invalidateCacheNamespaces(namespaces: readonly string[]): void {
  const uniqueNamespaces = new Set(namespaces);
  for (const namespace of uniqueNamespaces) {
    invalidateCacheNamespace(namespace);
  }
}

export function invalidateCacheKeys(entries: readonly CacheEntryRef[]): void {
  const seen = new Set<string>();

  for (const entry of entries) {
    const dedupeKey = `${entry.namespace}::${entry.key}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    invalidateCacheKey(entry.namespace, entry.key);
  }
}
