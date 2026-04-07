import { Navigate, createBrowserRouter } from "react-router-dom";

import { RequireAuth } from "../components/auth/RequireAuth.tsx";
import { AppShell } from "../components/layout/AppShell.tsx";
import { AuthPage } from "../pages/AuthPage.tsx";
import { BodyMetricsPage } from "../pages/BodyMetricsPage.tsx";
import { DashboardPage } from "../pages/DashboardPage.tsx";
import { ProgressPage } from "../pages/ProgressPage.tsx";
import { TrainingPlanPage } from "../pages/TrainingPlanPage.tsx";
import { WorkoutSessionPage } from "../pages/WorkoutSessionPage.tsx";

export const router = createBrowserRouter([
  {
    path: "/auth",
    element: <AuthPage />,
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
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/session", element: <WorkoutSessionPage /> },
      { path: "/plan", element: <TrainingPlanPage /> },
      { path: "/progress", element: <ProgressPage /> },
      { path: "/metrics", element: <BodyMetricsPage /> },
    ],
  },
]);
