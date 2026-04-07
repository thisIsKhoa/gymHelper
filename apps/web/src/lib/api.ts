const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1'
const AUTH_TOKEN_KEY = 'gymhelper-token'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(errorData.message ?? 'Request failed')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
