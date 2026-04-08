import clsx from "clsx";
import { Eye, EyeOff, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { setAuthToken, apiRequest } from "../lib/api.ts";

type AuthMode = "login" | "register";

interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectPath =
    (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const isLogin = mode === "login";
  const canSubmit =
    email.trim().length > 0 &&
    password.trim().length >= 8 &&
    (isLogin || name.trim().length > 0);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload =
        mode === "login" ? { email, password } : { name, email, password };

      const result = await apiRequest<AuthResponse>(endpoint, "POST", payload);
      setAuthToken(result.token);
      navigate(redirectPath, { replace: true });
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Authentication failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-6 sm:py-8">
      <section className="glass-card w-full max-w-md p-5 sm:p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Personal Workout Tracker
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--text)] sm:text-3xl">
          {isLogin ? "Welcome back" : "Create account"}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
          {isLogin
            ? "Sign in to sync workouts, progress charts, and body metrics on cloud database."
            : "Create your account to store all training data on cloud database."}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="ui-chip">
            <ShieldCheck size={14} /> Secure token auth
          </span>
          <span className="ui-chip">Fast sync across devices</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-[color:var(--surface-solid)] p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={clsx(
              "ui-btn min-h-10 w-full px-3 py-2 text-xs",
              isLogin ? "ui-btn-primary" : "ui-btn-ghost",
            )}
            aria-pressed={isLogin}
          >
            <span className="inline-flex items-center gap-1.5">
              <LogIn size={14} /> Login
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={clsx(
              "ui-btn min-h-10 w-full px-3 py-2 text-xs",
              !isLogin ? "ui-btn-primary" : "ui-btn-ghost",
            )}
            aria-pressed={!isLogin}
          >
            <span className="inline-flex items-center gap-1.5">
              <UserPlus size={14} /> Register
            </span>
          </button>
        </div>

        <form className="mt-6 space-y-3" onSubmit={submit}>
          {!isLogin ? (
            <label className="block">
              <span className="ui-label">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="ui-input"
                placeholder="Your display name"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="ui-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="ui-input"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="ui-label">Password</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                className="ui-input pr-11"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                className="ui-btn ui-btn-ghost absolute right-1.5 top-1/2 min-h-8 -translate-y-1/2 px-2"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="ui-btn ui-btn-primary w-full"
          >
            {isSubmitting ? "Please wait..." : isLogin ? "Login" : "Register"}
          </button>
        </form>

        {error ? (
          <p className="ui-status ui-status-danger mt-3">{error}</p>
        ) : null}

        <button
          type="button"
          onClick={() =>
            setMode((current) => (current === "login" ? "register" : "login"))
          }
          className="ui-btn ui-btn-ghost mt-4 w-full text-sm"
        >
          {isLogin
            ? "No account? Register now"
            : "Already have an account? Login"}
        </button>
      </section>
    </main>
  );
}
