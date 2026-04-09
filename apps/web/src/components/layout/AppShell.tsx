import clsx from "clsx";
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  Dumbbell,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  MoonStar,
  SunMedium,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { apiRequest, clearAuthToken } from "../../lib/api.ts";
import { useThemeStore } from "../../stores/theme-store.ts";

const navItems = [
  {
    to: "/dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    icon: LayoutDashboard,
  },
  { to: "/session", label: "Session", shortLabel: "Sess", icon: Dumbbell },
  { to: "/plan", label: "Plan", shortLabel: "Plan", icon: CalendarClock },
  { to: "/progress", label: "Progress", shortLabel: "Stats", icon: BarChart3 },
  { to: "/metrics", label: "Metrics", shortLabel: "Body", icon: HeartPulse },
  { to: "/library", label: "Library", shortLabel: "Lib", icon: BookOpen },
];

function titleFromPath(pathname: string): string {
  const active = navItems.find((item) => pathname.startsWith(item.to));
  return active?.label ?? "Workout Tracker";
}

function subtitleFromPath(pathname: string): string {
  if (pathname.startsWith("/session")) {
    return "Log sets quickly, track rest, and keep momentum during your workout.";
  }

  if (pathname.startsWith("/plan")) {
    return "Design weekly structure and reuse training templates that fit your schedule.";
  }

  if (pathname.startsWith("/progress")) {
    return "Review strength trends and compare sessions to guide next progression.";
  }

  if (pathname.startsWith("/metrics")) {
    return "Keep body metrics consistent to validate your training and nutrition outcomes.";
  }

  if (pathname.startsWith("/library")) {
    return "Maintain your exercise database so planning and logging stay frictionless.";
  }

  return "See your training signal at a glance, then jump into your next key action.";
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const pageTitle = titleFromPath(location.pathname);
  const pageSubtitle = subtitleFromPath(location.pathname);

  const handleLogout = async () => {
    try {
      await apiRequest("/auth/logout", "POST");
    } finally {
      // Cleanup legacy token from previous localStorage-based auth.
      clearAuthToken();
      navigate("/auth", { replace: true });
    }
  };

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="app-shell min-h-screen text-[var(--text)]">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color:var(--surface)]/88 px-4 py-3 backdrop-blur-xl md:px-6">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="max-w-[12.5rem] truncate text-[11px] uppercase tracking-[0.16em] text-[var(--muted)] sm:max-w-none sm:text-xs sm:tracking-[0.18em]">
                Personal Workout Tracker
              </p>
              <h1 className="truncate text-xl font-bold sm:text-2xl">
                {pageTitle}
              </h1>
              <p className="mt-1 hidden max-w-xl text-xs text-[var(--muted)] sm:block sm:text-sm">
                {pageSubtitle}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="ui-btn ui-btn-secondary pulse-ring inline-flex min-w-11 items-center justify-center px-3"
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
              >
                {theme === "dark" ? (
                  <SunMedium size={18} />
                ) : (
                  <MoonStar size={18} />
                )}
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-secondary inline-flex min-w-11 items-center justify-center px-3"
                onClick={() => void handleLogout()}
                aria-label="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl px-4 pb-[calc(6.25rem+env(safe-area-inset-bottom))] pt-5 md:px-6 lg:pb-8 lg:pl-24"
        >
          <motion.div
            key={location.pathname}
            className="section-enter"
            initial={
              prefersReducedMotion
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 12 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.24, ease: "easeOut" }
            }
          >
            <Outlet />
          </motion.div>
        </main>

        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[color:var(--surface)]/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-xl backdrop-blur lg:hidden"
        >
          <ul className="mx-auto grid w-full max-w-6xl grid-cols-6 items-stretch gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      clsx(
                        "flex min-h-11 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-[10px] font-medium leading-none transition sm:text-[11px]",
                        isActive
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-md"
                          : "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--surface-solid)] hover:text-[var(--text)]",
                      )
                    }
                  >
                    <Icon size={16} />
                    <span className="max-w-full truncate">
                      {item.shortLabel}
                    </span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <nav
          aria-label="Primary"
          className="fixed left-5 top-1/2 z-30 hidden -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[color:var(--surface)]/95 p-2 shadow-xl backdrop-blur lg:block"
        >
          <p className="px-3 pb-2 pt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            Navigate
          </p>
          <ul className="flex w-auto flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      clsx(
                        "flex min-h-11 min-w-[136px] items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition",
                        isActive
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--surface-solid)] hover:text-[var(--text)]",
                      )
                    }
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
}
