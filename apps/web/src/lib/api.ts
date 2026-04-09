const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1'
const AUTH_TOKEN_KEY = 'gymhelper-token'
const GET_CACHE_TTL_MS = Number(import.meta.env.VITE_HTTP_CACHE_TTL_MS ?? 20_000)

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface CacheEntry {
  expiresAt: number
  data: unknown
}

const getResponseCache = new Map<string, CacheEntry>()
const inFlightGetRequests = new Map<string, Promise<unknown>>()

function buildCacheKey(url: string, token: string | null): string {
  return `${token ?? 'anonymous'}:${url}`
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

export async function apiRequest<T>(path: string, method: HttpMethod, body?: unknown): Promise<T> {
  const token = getAuthToken()
  const url = `${API_BASE_URL}${path}`
  const cacheKey = buildCacheKey(url, token)

  if (method === 'GET') {
    const now = Date.now()
    const cached = getResponseCache.get(cacheKey)

    if (cached && cached.expiresAt > now) {
      return cached.data as T
    }

    const inFlight = inFlightGetRequests.get(cacheKey)
    if (inFlight) {
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

  const result = await performRequest<T>(url, method, token, body)

  // Conservative invalidation: mutation success clears cached GET data.
  getResponseCache.clear()
  inFlightGetRequests.clear()

  return result
}
