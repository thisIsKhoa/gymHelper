const EXERCISE_LIBRARY_BASE_KEY = ["exercise-library"] as const;

export const queryKeys = {
  dashboardOverview: ["dashboard-overview"] as const,
  bodyMetricsHistory: ["body-metrics-history"] as const,
  plans: ["plans"] as const,
  progressOverview: ["progress-overview"] as const,
  progressExercise: (exerciseName: string, weeks: number) =>
    ["progress-exercise", exerciseName, weeks] as const,
  exerciseLibraryBase: EXERCISE_LIBRARY_BASE_KEY,
  exerciseLibrary: (search: string = "") =>
    [...EXERCISE_LIBRARY_BASE_KEY, search] as const,
} as const;
