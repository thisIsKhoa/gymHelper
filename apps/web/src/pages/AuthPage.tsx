import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { setAuthToken, apiRequest } from '../lib/api.ts'

type AuthMode = 'login' | 'register'

interface AuthResponse {
  token: string
  user: {
    id: string
    email: string
    name: string
  }
}

export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectPath = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'
      const payload = mode === 'login' ? { email, password } : { name, email, password }

      const result = await apiRequest<AuthResponse>(endpoint, 'POST', payload)
      setAuthToken(result.token)
      navigate(redirectPath, { replace: true })
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message)
      } else {
        setError('Authentication failed')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-8">
      <section className="glass-card w-full max-w-md p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Personal Workout Tracker</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {mode === 'login'
            ? 'Sign in to sync workouts, progress charts, and body metrics on cloud database.'
            : 'Create your account to store all training data on cloud database.'}
        </p>

        <form className="mt-6 space-y-3" onSubmit={submit}>
          {mode === 'register' ? (
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

        <button
          type="button"
          onClick={() => setMode((current) => (current === 'login' ? 'register' : 'login'))}
          className="mt-4 text-sm text-[var(--muted)] underline underline-offset-4"
        >
          {mode === 'login' ? 'No account? Register now' : 'Already have an account? Login'}
        </button>
      </section>
    </main>
  )
}
