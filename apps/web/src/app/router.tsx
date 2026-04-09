import { Suspense, lazy, type ReactNode } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import { RequireAuth } from "../components/auth/RequireAuth.tsx";
import { AppShell } from "../components/layout/AppShell.tsx";

const AuthPage = lazy(async () => {
  const module = await import("../pages/AuthPage.tsx");
  return { default: module.AuthPage };
});

const DashboardPage = lazy(async () => {
  const module = await import("../pages/DashboardPage.tsx");
  return { default: module.DashboardPage };
});

const WorkoutSessionPage = lazy(async () => {
  const module = await import("../pages/WorkoutSessionPage.tsx");
  return { default: module.WorkoutSessionPage };
});

const TrainingPlanPage = lazy(async () => {
  const module = await import("../pages/TrainingPlanPage.tsx");
  return { default: module.TrainingPlanPage };
});

const ProgressPage = lazy(async () => {
  const module = await import("../pages/ProgressPage.tsx");
  return { default: module.ProgressPage };
});

const ProfilePage = lazy(async () => {
  const module = await import("../pages/ProfilePage.tsx");
  return { default: module.ProfilePage };
});

const BodyMetricsPage = lazy(async () => {
  const module = await import("../pages/BodyMetricsPage.tsx");
  return { default: module.BodyMetricsPage };
});

const ExerciseLibraryPage = lazy(async () => {
  const module = await import("../pages/ExerciseLibraryPage.tsx");
  return { default: module.ExerciseLibraryPage };
});

function withSuspense(element: ReactNode) {
  return (
    <Suspense
      fallback={
        <p className="px-4 py-6 text-sm text-[var(--muted)]">Loading...</p>
      }
    >
      {element}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/auth",
    element: withSuspense(<AuthPage />),
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "/dashboard", element: withSuspense(<DashboardPage />) },
      { path: "/session", element: withSuspense(<WorkoutSessionPage />) },
      { path: "/plan", element: withSuspense(<TrainingPlanPage />) },
      { path: "/progress", element: withSuspense(<ProgressPage />) },
      { path: "/profile", element: withSuspense(<ProfilePage />) },
      { path: "/metrics", element: withSuspense(<BodyMetricsPage />) },
      { path: "/library", element: withSuspense(<ExerciseLibraryPage />) },
    ],
  },
]);
