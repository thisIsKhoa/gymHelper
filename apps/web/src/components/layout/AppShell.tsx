import clsx from "clsx";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CalendarClock,
  Dumbbell,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  MoonStar,
  Sparkles,
  SunMedium,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useSuccessToast } from "../ui/success-toast.tsx";
import { apiRequest, clearAuthToken } from "../../lib/api.ts";
import { pingGamificationActivity } from "../../lib/gamification.ts";
import {
  connectGamificationSocket,
  disconnectGamificationSocket,
  onAchievementUnlocked,
  onMuscleLevelUp,
} from "../../lib/gamification-socket.ts";
import { useThemeStore } from "../../stores/theme-store.ts";

const navItems = [
  {
    to: "/dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    icon: LayoutDashboard,
  },
  { to: "/plan", label: "Plan", shortLabel: "Plan", icon: CalendarClock },
  { to: "/progress", label: "Progress", shortLabel: "Stats", icon: BarChart3 },
  { to: "/session", label: "Session", shortLabel: "Sess", icon: Dumbbell },
  { to: "/profile", label: "Profile", shortLabel: "Prof", icon: Sparkles },
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

  if (pathname.startsWith("/profile")) {
    return "Track muscle skill trees, monitor balance, and unlock new achievements.";
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
  const { showSuccessToast } = useSuccessToast();
  const prefersReducedMotion = useReducedMotion();
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const pageTitle = titleFromPath(location.pathname);
  const pageSubtitle = subtitleFromPath(location.pathname);
  const currentDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(new Date()),
    [],
  );

  useEffect(() => {
    let disposed = false;
    let stopAchievement: () => void = () => {};
    let stopLevelUp: () => void = () => {};

    void (async () => {
      await pingGamificationActivity().catch(() => undefined);

      const socket = await connectGamificationSocket();
      if (!socket || disposed) {
        return;
      }

      stopAchievement = onAchievementUnlocked((payload) => {
        showSuccessToast({
          title: payload.title || "Achievement Unlocked",
          message: payload.message,
          durationMs: 5200,
        });

        void apiRequest("/gamification/notifications/consume", "POST", {
          limit: 20,
        });
        window.dispatchEvent(new CustomEvent("gamification:profile-refresh"));
      });

      stopLevelUp = onMuscleLevelUp((payload) => {
        showSuccessToast({
          title: payload.title || "Level Up",
          message: payload.message,
          durationMs: 5600,
        });

        window.dispatchEvent(
          new CustomEvent("gamification:level-up", {
            detail: {
              skill: payload.skill,
              level: payload.level,
            },
          }),
        );
        void apiRequest("/gamification/notifications/consume", "POST", {
          limit: 20,
        });
        window.dispatchEvent(new CustomEvent("gamification:profile-refresh"));
      });
    })();

    return () => {
      disposed = true;
      stopAchievement();
      stopLevelUp();
      disconnectGamificationSocket();
    };
  }, [showSuccessToast]);

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
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color:var(--surface)]/92 px-3 py-2 backdrop-blur-xl sm:px-4 md:px-6">
          <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="ui-kicker max-w-[14rem] truncate sm:max-w-none">
                Personal Workout Tracker
              </p>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold sm:text-2xl">
                  {pageTitle}
                </h1>
              </div>
              <p className="mt-1 hidden max-w-xl text-xs leading-relaxed text-[var(--muted)] sm:block sm:text-sm">
                {pageSubtitle}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="ui-chip hidden items-center gap-1 md:inline-flex">
                <CalendarDays size={13} />
                {currentDateLabel}
              </span>
              <button
                type="button"
                className="ui-btn ui-btn-secondary pulse-ring inline-flex min-w-11 items-center justify-center gap-2 px-3"
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
              >
                {theme === "dark" ? (
                  <SunMedium size={18} />
                ) : (
                  <MoonStar size={18} />
                )}
                <span className="hidden text-xs font-semibold md:inline">
                  {theme === "dark" ? "Light" : "Dark"}
                </span>
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-secondary inline-flex min-w-11 items-center justify-center gap-2 px-3"
                onClick={() => void handleLogout()}
                aria-label="Logout"
              >
                <LogOut size={16} />
                <span className="hidden text-xs font-semibold lg:inline">
                  Logout
                </span>
              </button>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className="mx-auto w-full max-w-[1120px] px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 sm:pb-[calc(6.2rem+env(safe-area-inset-bottom))] sm:pt-5 md:px-6 lg:pb-8 lg:pl-24"
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
          aria-label="Bottom navigation"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[color:var(--surface)]/96 px-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-14px_36px_rgba(15,23,42,0.22)] backdrop-blur-xl lg:hidden"
        >
          <ul className="mx-auto grid w-full max-w-[1120px] grid-cols-7 gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to} className="min-w-0">
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      clsx(
                        "flex min-h-10 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 py-1 text-[9px] font-semibold leading-none transition",
                        isActive
                          ? "ui-nav-link-active"
                          : "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--surface-solid)] hover:text-[var(--text)]",
                      )
                    }
                  >
                    <Icon size={13} />
                    <span className="max-w-full truncate px-0.5 leading-none">
                      {item.shortLabel}
                    </span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <nav
          aria-label="Side navigation"
          className="fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[color:var(--surface)]/95 p-2 shadow-xl backdrop-blur lg:block"
        >
          <p className="ui-kicker px-3 pb-2 pt-1">Navigate</p>
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
                          ? "ui-nav-link-active"
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
