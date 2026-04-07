import clsx from "clsx";
import {
  BarChart3,
  HeartPulse,
  CalendarClock,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  MoonStar,
  SunMedium,
} from "lucide-react";
import { motion } from "framer-motion";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { clearAuthToken } from "../../lib/api.ts";
import { useThemeStore } from "../../stores/theme-store.ts";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/session", label: "Session", icon: Dumbbell },
  { to: "/plan", label: "Plan", icon: CalendarClock },
  { to: "/progress", label: "Progress", icon: BarChart3 },
  { to: "/metrics", label: "Metrics", icon: HeartPulse },
];

function titleFromPath(pathname: string): string {
  const active = navItems.find((item) => pathname.startsWith(item.to));
  return active?.label ?? "Workout Tracker";
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const handleLogout = () => {
    clearAuthToken();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="app-shell min-h-screen text-[var(--text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color:var(--surface)]/90 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Personal Workout Tracker
            </p>
            <h1 className="text-2xl font-bold">
              {titleFromPath(location.pathname)}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="pulse-ring rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-2 text-[var(--text)] transition hover:scale-105"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
            >
              {theme === "dark" ? (
                <SunMedium size={20} />
              ) : (
                <MoonStar size={20} />
              )}
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-2 text-[var(--text)] transition hover:scale-105"
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 md:px-6 lg:pb-8">
        <motion.div
          key={location.pathname}
          className="section-enter"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <Outlet />
        </motion.div>
      </main>

      <nav className="fixed bottom-4 left-1/2 z-30 w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-2xl border border-[var(--border)] bg-[color:var(--surface)]/95 p-1.5 shadow-xl backdrop-blur lg:left-6 lg:top-1/2 lg:w-auto lg:-translate-x-0 lg:-translate-y-1/2 lg:p-2">
        <ul className="flex items-center justify-between gap-1 lg:flex-col lg:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      "flex min-w-[72px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition lg:min-w-[126px] lg:justify-start lg:text-sm",
                      isActive
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--muted)] hover:bg-[var(--surface-solid)] hover:text-[var(--text)]",
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
  );
}
