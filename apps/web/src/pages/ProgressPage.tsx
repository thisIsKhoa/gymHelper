import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer } from "../components/ui/ChartContainer.tsx";
import { Card } from "../components/ui/Card.tsx";
import { LoadingState } from "../components/ui/LoadingState.tsx";
import { apiRequest } from "../lib/api.ts";
import { QUERY_GC_MS, QUERY_STALE_MS } from "../lib/query-config.ts";
import { queryKeys } from "../lib/query-keys.ts";
import type { ExerciseLibraryItem } from "../types/workout.ts";

interface ExerciseProgressResponse {
  exerciseName: string;
  points: Array<{
    week: string;
    avgWeightKg: number;
    maxWeightKg: number;
    totalVolume: number;
    maxEstimated1Rm: number;
  }>;
}

interface WorkoutRecord {
  exerciseName: string;
  bestWeightKg: number;
  bestVolume: number;
  achievedAt: string;
}

interface WorkoutAnalytics {
  weeks: Array<{
    isoWeek: string;
    sessionsCount: number;
    totalVolume: number;
    strongestLiftKg: number;
  }>;
  thisWeek: {
    isoWeek: string;
    sessionsCount: number;
    totalVolume: number;
    strongestLiftKg: number;
  };
  streakDays: number;
}

interface ProgressOverviewResponse {
  benchProgressByWeek: Array<{
    week: string;
    avgWeightKg: number;
    maxWeightKg: number;
    totalVolume: number;
    maxEstimated1Rm: number;
  }>;
  personalRecords: WorkoutRecord[];
  workoutAnalytics: WorkoutAnalytics;
}

function formatShortWeek(isoWeek: string) {
  const [year, week] = isoWeek.split("-W");
  if (!week) {
    return isoWeek;
  }

  return `${year?.slice(-2)}W${week}`;
}

export function ProgressPage() {
  const [selectedExercise, setSelectedExercise] = useState("Bench Press");
  const [weeks, setWeeks] = useState(12);

  const exerciseLibraryQuery = useQuery({
    queryKey: queryKeys.exerciseLibrary(),
    queryFn: () => apiRequest<ExerciseLibraryItem[]>("/exercises", "GET"),
    staleTime: QUERY_STALE_MS.long,
    gcTime: QUERY_GC_MS.long,
    refetchOnWindowFocus: false,
  });

  const progressOverviewQuery = useQuery({
    queryKey: queryKeys.progressOverview,
    queryFn: () =>
      apiRequest<ProgressOverviewResponse>("/progress/overview", "GET"),
    staleTime: QUERY_STALE_MS.medium,
    gcTime: QUERY_GC_MS.long,
    refetchOnWindowFocus: false,
  });

  const exerciseProgressQuery = useQuery({
    queryKey: queryKeys.progressExercise(selectedExercise, weeks),
    queryFn: () =>
      apiRequest<ExerciseProgressResponse>(
        `/progress/exercise/${encodeURIComponent(selectedExercise)}?weeks=${weeks}`,
        "GET",
      ),
    enabled: selectedExercise.trim().length > 0,
    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_MS.medium,
    gcTime: QUERY_GC_MS.long,
    refetchOnWindowFocus: false,
  });

  const library = exerciseLibraryQuery.data ?? [];
  const points = exerciseProgressQuery.data?.points ?? [];
  const records = progressOverviewQuery.data?.personalRecords ?? [];
  const analytics = progressOverviewQuery.data?.workoutAnalytics ?? null;

  useEffect(() => {
    if (library.length === 0) {
      return;
    }

    const hasSelectedExercise = library.some(
      (exercise) => exercise.name === selectedExercise,
    );

    if (!hasSelectedExercise) {
      setSelectedExercise(library[0]?.name ?? "Bench Press");
    }
  }, [library, selectedExercise]);

  const isLoading =
    exerciseLibraryQuery.isLoading ||
    progressOverviewQuery.isLoading ||
    exerciseProgressQuery.isLoading;

  const loadError =
    exerciseLibraryQuery.error ||
    progressOverviewQuery.error ||
    exerciseProgressQuery.error;

  const error =
    loadError instanceof Error
      ? loadError.message
      : loadError
        ? "Failed to load progress data"
        : null;

  if (isLoading) {
    return <LoadingState message="Loading progress..." cardCount={3} />;
  }

  if (error) {
    return <p className="ui-status ui-status-danger">{error}</p>;
  }

  const hasExerciseData = points.length > 0;
  const hasAnalyticsData = (analytics?.weeks.length ?? 0) > 0;

  return (
    <div className="grid gap-4">
      <Card title="Progress Controls" subtitle="Select exercise and timeline">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="ui-label">Exercise</span>
            <select
              value={selectedExercise}
              onChange={(event) => setSelectedExercise(event.target.value)}
              className="ui-select"
            >
              {library.map((exercise) => (
                <option key={exercise.id} value={exercise.name}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="ui-label">Weeks</span>
            <select
              value={weeks}
              onChange={(event) => setWeeks(Number(event.target.value))}
              className="ui-select"
            >
              <option value={8}>8 weeks</option>
              <option value={12}>12 weeks</option>
              <option value={16}>16 weeks</option>
              <option value={24}>24 weeks</option>
            </select>
          </label>
        </div>
      </Card>

      <Card
        title={`${selectedExercise} Weight & 1RM`}
        subtitle="Weekly max load and estimated 1RM"
      >
        {hasExerciseData ? (
          <ChartContainer className="h-72 w-full" minHeight={240}>
            <LineChart data={points}>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="rgba(148,163,184,0.25)"
              />
              <XAxis
                dataKey="week"
                tickFormatter={formatShortWeek}
                minTickGap={24}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(label) => formatShortWeek(String(label))}
              />
              <Line
                type="monotone"
                dataKey="maxWeightKg"
                stroke="var(--accent)"
                strokeWidth={3}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="maxEstimated1Rm"
                stroke="var(--accent-alt)"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className="ui-empty-state text-sm">
            No data found for this exercise yet. Log more workouts to see the
            chart.
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Volume Progression"
          subtitle="Total weekly volume for selected exercise"
        >
          {hasExerciseData ? (
            <ChartContainer className="h-64 w-full" minHeight={220}>
              <BarChart data={points}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(148,163,184,0.25)"
                />
                <XAxis
                  dataKey="week"
                  tickFormatter={formatShortWeek}
                  minTickGap={24}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(label) => formatShortWeek(String(label))}
                />
                <Bar
                  dataKey="totalVolume"
                  fill="var(--accent-alt)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="ui-empty-state text-sm">
              No volume data available for this exercise yet.
            </p>
          )}
        </Card>

        <Card
          title="Weekly Frequency"
          subtitle="Sessions per week and strongest lift"
        >
          {hasAnalyticsData ? (
            <ChartContainer className="h-64 w-full" minHeight={220}>
              <BarChart data={analytics?.weeks ?? []}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(148,163,184,0.25)"
                />
                <XAxis
                  dataKey="isoWeek"
                  tickFormatter={formatShortWeek}
                  minTickGap={24}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(label) => formatShortWeek(String(label))}
                />
                <Bar
                  dataKey="sessionsCount"
                  fill="var(--accent)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="ui-empty-state text-sm">
              No training frequency data available yet.
            </p>
          )}
          {analytics ? (
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <p className="ui-tile px-2 py-1 text-(--muted)">
                This week sessions: {analytics.thisWeek.sessionsCount}
              </p>
              <p className="ui-tile px-2 py-1 text-(--muted)">
                Strongest lift: {analytics.thisWeek.strongestLiftKg}kg
              </p>
              <p className="ui-tile px-2 py-1 text-(--muted)">
                Streak: {analytics.streakDays} days
              </p>
            </div>
          ) : null}
        </Card>
      </div>

      <Card title="Personal Records" subtitle="Best lift per exercise">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {records.length === 0 ? (
            <p className="ui-empty-state text-sm">No PR data available yet.</p>
          ) : (
            records.map((pr) => (
              <article key={pr.exerciseName} className="ui-tile p-3">
                <p className="font-semibold">{pr.exerciseName}</p>
                <p className="text-sm text-(--muted)">
                  {pr.bestWeightKg}kg · Vol {pr.bestVolume.toFixed(0)}
                </p>
                <p className="text-xs text-(--muted)">
                  {new Date(pr.achievedAt).toLocaleDateString()}
                </p>
              </article>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
