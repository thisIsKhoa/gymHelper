import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "../components/ui/Card.tsx";
import { apiRequest } from "../lib/api.ts";
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

export function ProgressPage() {
  const [library, setLibrary] = useState<ExerciseLibraryItem[]>([]);
  const [selectedExercise, setSelectedExercise] = useState("Bench Press");
  const [weeks, setWeeks] = useState(12);
  const [points, setPoints] = useState<ExerciseProgressResponse["points"]>([]);
  const [records, setRecords] = useState<WorkoutRecord[]>([]);
  const [analytics, setAnalytics] = useState<WorkoutAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const [exerciseLibrary, progress, prs, workoutAnalytics] =
          await Promise.all([
            apiRequest<ExerciseLibraryItem[]>("/exercises", "GET"),
            apiRequest<ExerciseProgressResponse>(
              `/progress/exercise/${encodeURIComponent(selectedExercise)}?weeks=${weeks}`,
              "GET",
            ),
            apiRequest<WorkoutRecord[]>("/workouts/prs", "GET"),
            apiRequest<WorkoutAnalytics>("/workouts/analytics", "GET"),
          ]);

        setLibrary(exerciseLibrary);
        setPoints(progress.points);
        setRecords(prs);
        setAnalytics(workoutAnalytics);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load progress data",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [selectedExercise, weeks]);

  if (isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading progress...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="grid gap-4">
      <Card title="Progress Controls" subtitle="Select exercise and timeline">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Exercise
            </span>
            <select
              value={selectedExercise}
              onChange={(event) => setSelectedExercise(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            >
              {library.map((exercise) => (
                <option key={exercise.id} value={exercise.name}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Weeks
            </span>
            <select
              value={weeks}
              onChange={(event) => setWeeks(Number(event.target.value))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
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
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <LineChart data={points}>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="rgba(148,163,184,0.25)"
              />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
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
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Volume Progression"
          subtitle="Total weekly volume for selected exercise"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={points}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(148,163,184,0.25)"
                />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="totalVolume"
                  fill="var(--accent-alt)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          title="Weekly Frequency"
          subtitle="Sessions per week and strongest lift"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={analytics?.weeks ?? []}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(148,163,184,0.25)"
                />
                <XAxis dataKey="isoWeek" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="sessionsCount"
                  fill="var(--accent)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {analytics ? (
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <p className="rounded-lg border border-[var(--border)] px-2 py-1 text-[var(--muted)]">
                This week sessions: {analytics.thisWeek.sessionsCount}
              </p>
              <p className="rounded-lg border border-[var(--border)] px-2 py-1 text-[var(--muted)]">
                Strongest lift: {analytics.thisWeek.strongestLiftKg}kg
              </p>
              <p className="rounded-lg border border-[var(--border)] px-2 py-1 text-[var(--muted)]">
                Streak: {analytics.streakDays} days
              </p>
            </div>
          ) : null}
        </Card>
      </div>

      <Card title="Personal Records" subtitle="Best lift per exercise">
        <div className="grid gap-3 md:grid-cols-3">
          {records.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No PR data available yet.
            </p>
          ) : (
            records.map((pr) => (
              <article
                key={pr.exerciseName}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-3"
              >
                <p className="font-semibold">{pr.exerciseName}</p>
                <p className="text-sm text-[var(--muted)]">
                  {pr.bestWeightKg}kg · Vol {pr.bestVolume.toFixed(0)}
                </p>
                <p className="text-xs text-[var(--muted)]">
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
