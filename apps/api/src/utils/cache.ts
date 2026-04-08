type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const valueStore = new Map<string, CacheEntry>();
const inFlightStore = new Map<string, Promise<unknown>>();
const namespaceVersions = new Map<string, number>();

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

function getNamespaceVersion(namespace: string): number {
  return namespaceVersions.get(namespace) ?? 0;
}

function toVersionedKey(namespace: string, version: number, key: string): string {
  return `${namespace}#${version}#${key}`;
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

  const namespaceVersion = getNamespaceVersion(namespace);
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

  const loadPromise = loader()
    .then((value) => {
      if (getNamespaceVersion(namespace) === namespaceVersion) {
        valueStore.set(versionedKey, {
          value,
          expiresAt: Date.now() + ttlMs,
        });
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
  namespaceVersions.set(namespace, getNamespaceVersion(namespace) + 1);

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
