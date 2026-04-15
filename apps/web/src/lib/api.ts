const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1'
const AUTH_TOKEN_KEY = 'gymhelper-token'
const GET_CACHE_TTL_MS = Number(import.meta.env.VITE_HTTP_CACHE_TTL_MS ?? 20_000)
const API_BASE_PATH = (() => {
  try {
    const pathname = new URL(API_BASE_URL).pathname
    return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  } catch {
    return '/api/v1'
  }
})()

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface ApiRequestOptions {
  invalidatePrefixes?: string[]
}

interface CacheEntry {
  expiresAt: number
  data: unknown
}

const getResponseCache = new Map<string, CacheEntry>()
const inFlightGetRequests = new Map<string, Promise<unknown>>()

interface ApiCacheDiagnostics {
  totalRequests: number
  mutationRequests: number
  getRequests: number
  getCacheHits: number
  getCacheMisses: number
  inFlightDedupHits: number
  cacheEntryCount: number
  inFlightEntryCount: number
  lastResetAt: string
}

const apiCacheMetrics = {
  totalRequests: 0,
  mutationRequests: 0,
  getRequests: 0,
  getCacheHits: 0,
  getCacheMisses: 0,
  inFlightDedupHits: 0,
  lastResetAt: new Date().toISOString(),
}

export function getApiCacheDiagnostics(): ApiCacheDiagnostics {
  return {
    ...apiCacheMetrics,
    cacheEntryCount: getResponseCache.size,
    inFlightEntryCount: inFlightGetRequests.size,
  }
}

export function resetApiCacheDiagnostics(): void {
  apiCacheMetrics.totalRequests = 0
  apiCacheMetrics.mutationRequests = 0
  apiCacheMetrics.getRequests = 0
  apiCacheMetrics.getCacheHits = 0
  apiCacheMetrics.getCacheMisses = 0
  apiCacheMetrics.inFlightDedupHits = 0
  apiCacheMetrics.lastResetAt = new Date().toISOString()
}

function buildCacheKey(url: string, token: string | null): string {
  return `${token ?? 'anonymous'}:${url}`
}

function splitCacheKey(cacheKey: string): { token: string; url: string } | null {
  const separatorIndex = cacheKey.indexOf(':')
  if (separatorIndex <= 0) {
    return null
  }

  return {
    token: cacheKey.slice(0, separatorIndex),
    url: cacheKey.slice(separatorIndex + 1),
  }
}

function toPathname(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

function normalizePrefix(prefix: string): string {
  if (prefix === '*') {
    return prefix
  }

  return prefix.startsWith('/') ? prefix : `/${prefix}`
}

function shouldInvalidatePath(pathname: string, prefixes: string[]): boolean {
  const normalizedPath = pathname.endsWith('/') && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname

  return prefixes.some((prefix) => {
    if (prefix === '*') {
      return true
    }

    const normalizedPrefix = normalizePrefix(prefix)
    const fullPrefix = `${API_BASE_PATH}${normalizedPrefix}`
    return normalizedPath === fullPrefix || normalizedPath.startsWith(`${fullPrefix}/`)
  })
}

function invalidateTokenCache(token: string | null, prefixes: string[]): void {
  if (prefixes.length === 0) {
    return
  }

  if (prefixes.includes('*')) {
    getResponseCache.clear()
    inFlightGetRequests.clear()
    return
  }

  const tokenKey = token ?? 'anonymous'

  for (const key of getResponseCache.keys()) {
    const parsed = splitCacheKey(key)
    if (!parsed || parsed.token !== tokenKey) {
      continue
    }

    const pathname = toPathname(parsed.url)
    if (shouldInvalidatePath(pathname, prefixes)) {
      getResponseCache.delete(key)
    }
  }

  for (const key of inFlightGetRequests.keys()) {
    const parsed = splitCacheKey(key)
    if (!parsed || parsed.token !== tokenKey) {
      continue
    }

    const pathname = toPathname(parsed.url)
    if (shouldInvalidatePath(pathname, prefixes)) {
      inFlightGetRequests.delete(key)
    }
  }
}

function inferMutationInvalidationPrefixes(path: string): string[] {
  const normalizedPath = path.split('?')[0] ?? path

  if (normalizedPath.startsWith('/auth')) {
    return ['*']
  }

  if (normalizedPath.startsWith('/workouts')) {
    return ['/workouts', '/dashboard/overview', '/progress/overview', '/progress/exercise']
  }

  if (normalizedPath.startsWith('/body-metrics')) {
    return ['/body-metrics/history', '/body-metrics/latest', '/dashboard/overview']
  }

  if (normalizedPath.startsWith('/plans')) {
    return ['/plans', '/dashboard/overview']
  }

  if (normalizedPath.startsWith('/exercises')) {
    return ['/exercises', '/workouts/suggestion', '/progress/overview']
  }

  if (normalizedPath.startsWith('/progress')) {
    return ['/progress/overview', '/progress/exercise']
  }

  if (normalizedPath.startsWith('/gamification')) {
    return ['/gamification', '/dashboard/overview']
  }

  return ['*']
}

export function invalidateApiCache(prefixes: string[] = ['*']): void {
  const token = getAuthToken()
  invalidateTokenCache(token, prefixes)
}

async function performRequest<T>(
  url: string,
  method: HttpMethod,
  token: string | null,
  body?: unknown,
  cacheKey?: string,
): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (response.status === 304 && method === 'GET' && cacheKey) {
    const cached = getResponseCache.get(cacheKey)
    if (cached) {
      return cached.data as T
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(errorData.message ?? 'Request failed')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function getAuthToken(): string | null {
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken(): void {
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
}

export async function apiRequest<T>(
  path: string,
  method: HttpMethod,
  body?: unknown,
  options?: ApiRequestOptions,
): Promise<T> {
  apiCacheMetrics.totalRequests += 1
  const token = getAuthToken()
  const url = `${API_BASE_URL}${path}`
  const cacheKey = buildCacheKey(url, token)

  if (method === 'GET') {
    apiCacheMetrics.getRequests += 1
    const now = Date.now()
    const cached = getResponseCache.get(cacheKey)

    if (cached && cached.expiresAt > now) {
      apiCacheMetrics.getCacheHits += 1
      return cached.data as T
    }

    apiCacheMetrics.getCacheMisses += 1

    const inFlight = inFlightGetRequests.get(cacheKey)
    if (inFlight) {
      apiCacheMetrics.inFlightDedupHits += 1
      return inFlight as Promise<T>
    }

    const requestPromise = performRequest<T>(url, method, token, undefined, cacheKey)
      .then((data) => {
        getResponseCache.set(cacheKey, {
          expiresAt: Date.now() + GET_CACHE_TTL_MS,
          data,
        })

        return data
      })
      .finally(() => {
        inFlightGetRequests.delete(cacheKey)
      })

    inFlightGetRequests.set(cacheKey, requestPromise as Promise<unknown>)
    return requestPromise
  }

  apiCacheMetrics.mutationRequests += 1
  const result = await performRequest<T>(url, method, token, body)

  const invalidatePrefixes = options?.invalidatePrefixes ?? inferMutationInvalidationPrefixes(path)
  invalidateTokenCache(token, invalidatePrefixes)

  return result
}
