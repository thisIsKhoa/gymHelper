import clsx from "clsx";
import { Eye, EyeOff, KeyRound, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { apiRequest, setAuthToken } from "../lib/api.ts";

type AuthMode = "login" | "register" | "forgot_password" | "recovery_success";

interface AuthResponse {
  user?: {
    id: string;
    email: string;
    name: string;
  };
  token?: string;
  recoveryCode?: string;
  message?: string;
}

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodeInput, setRecoveryCodeInput] = useState("");
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);

  const redirectPath =
    (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const isLogin = mode === "login";
  
  let canSubmit = false;
  if (mode === "login") {
    canSubmit = email.trim().length > 0 && password.trim().length >= 8;
  } else if (mode === "register") {
    canSubmit = email.trim().length > 0 && password.trim().length >= 8 && name.trim().length > 0;
  } else if (mode === "forgot_password") {
    canSubmit = email.trim().length > 0 && password.trim().length >= 8 && recoveryCodeInput.trim().length === 6;
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setIsSuccessMessage(false);

    try {
      if (mode === "forgot_password") {
        await apiRequest("/auth/reset-password", "POST", { email, newPassword: password, recoveryCode: recoveryCodeInput });
        setMode("login");
        setIsSuccessMessage(true);
        setError("Password reset successfully. You can now login.");
        return;
      }

      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload =
        mode === "login" ? { email, password } : { name, email, password };

      const result = await apiRequest<AuthResponse>(endpoint, "POST", payload);
      if (!result.user?.id) {
        throw new Error("Authentication failed");
      }
      
      if (result.token) {
        setAuthToken(result.token);
      }
      
      if (mode === "register" && result.recoveryCode) {
        setGeneratedRecoveryCode(result.recoveryCode);
        setMode("recovery_success");
        return;
      }
      
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

  if (mode === "recovery_success") {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-4 py-6 sm:py-8">
        <section className="glass-card ui-soft-shadow w-full max-w-md p-5 sm:p-6 md:p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <KeyRound size={28} />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text)]">Save Your Recovery Code</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            If you ever forget your password, you will need this 6-digit code to securely reset it. Please store it somewhere safe now.
          </p>
          <div className="my-6 rounded-lg bg-[var(--surface-solid)] p-6 text-center shadow-inner">
            <span className="text-4xl font-mono font-bold tracking-[0.25em] text-[var(--text)]">{generatedRecoveryCode}</span>
          </div>
          <button
            type="button"
            className="ui-btn ui-btn-primary w-full shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => navigate(redirectPath, { replace: true })}
          >
            I have saved it safely
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-6 sm:py-8">
      <section className="glass-card ui-soft-shadow w-full max-w-md p-5 sm:p-6 md:p-8">
        <p className="ui-kicker">Personal Workout Tracker</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--text)] sm:text-3xl">
          {isLogin ? "Welcome back" : mode === "register" ? "Create account" : "Reset Password"}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
          {isLogin
            ? "Sign in to sync workouts, progress charts, and body metrics on cloud database."
            : mode === "register"
            ? "Create your account to store all training data on cloud database."
            : "Enter your 6-digit recovery code and a new password."}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="ui-chip">
            <ShieldCheck size={14} /> Secure token auth
          </span>
          <span className="ui-chip">Fast sync across devices</span>
        </div>

        {mode !== "forgot_password" ? (
          <div className="ui-panel mt-5 grid grid-cols-2 gap-1 p-1">
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
                mode === "register" ? "ui-btn-primary" : "ui-btn-ghost",
              )}
              aria-pressed={mode === "register"}
            >
              <span className="inline-flex items-center gap-1.5">
                <UserPlus size={14} /> Register
              </span>
            </button>
          </div>
        ) : null}

        <form className="mt-6 space-y-3" onSubmit={submit}>
          {mode === "register" ? (
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

          {mode === "forgot_password" ? (
            <label className="block">
              <span className="ui-label">Recovery Code</span>
              <input
                value={recoveryCodeInput}
                onChange={(event) => setRecoveryCodeInput(event.target.value)}
                required
                maxLength={6}
                className="ui-input font-mono uppercase"
                placeholder="123456"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="ui-label">{mode === "forgot_password" ? "New Password" : "Password"}</span>
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
            className="ui-btn ui-btn-primary w-full shadow-md"
          >
            {isSubmitting ? "Please wait..." : isLogin ? "Login" : mode === "register" ? "Register" : "Reset Password"}
          </button>
        </form>

        {error ? (
          <p className={clsx("ui-status mt-3", isSuccessMessage ? "ui-status-success" : "ui-status-danger")}>{error}</p>
        ) : null}

        {mode === "login" ? (
          <button
            type="button"
            onClick={() => {
              setMode("forgot_password");
              setError(null);
            }}
            className="ui-btn ui-btn-ghost mt-2 w-full text-sm"
          >
            Forgot password? Use recovery code
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setMode((current) => (current === "login" ? "register" : "login"));
            setError(null);
          }}
          className="ui-btn ui-btn-ghost mt-4 w-full text-sm"
        >
          {mode === "login"
            ? "No account? Register now"
            : mode === "register"
            ? "Already have an account? Login"
            : "Back to Login"}
        </button>
      </section>
    </main>
  );
}
