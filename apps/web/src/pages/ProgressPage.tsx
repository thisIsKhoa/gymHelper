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

interface ProgressOverview {
  benchProgressByWeek: Array<{ week: string; maxWeightKg: number }>;
  personalRecords: Array<{ exerciseName: string; bestWeightKg: number; achievedAt: string }>;
}

interface DashboardOverview {
  volumeTrend: Array<{ date: string; volume: number }>;
  workoutFrequency: Array<{ week: string; sessionsCount: number }>;
}

export function ProgressPage() {
  const [benchData, setBenchData] = useState<Array<{ week: string; maxWeightKg: number }>>([]);
  const [records, setRecords] = useState<Array<{ exerciseName: string; bestWeightKg: number; achievedAt: string }>>([]);
  const [volumeData, setVolumeData] = useState<Array<{ date: string; volume: number }>>([]);
  const [frequencyData, setFrequencyData] = useState<Array<{ week: string; sessionsCount: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const [progress, dashboard] = await Promise.all([
          apiRequest<ProgressOverview>("/progress/overview", "GET"),
          apiRequest<DashboardOverview>("/dashboard/overview", "GET"),
        ]);

        setBenchData(progress.benchProgressByWeek);
        setRecords(progress.personalRecords);
        setVolumeData(dashboard.volumeTrend);
        setFrequencyData(dashboard.workoutFrequency);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load progress data");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  if (isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading progress...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="grid gap-4">
      <Card title="Bench Press Progress by Week" subtitle="Performance-first tracking for long-term overload">
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <LineChart data={benchData}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.25)" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="maxWeightKg" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Volume Trend" subtitle="Structured daily points for chart rendering">
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={volumeData}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="volume" fill="var(--accent-alt)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Workout Frequency" subtitle="Session count by week">
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={frequencyData}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sessionsCount" fill="var(--accent)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Personal Records" subtitle="Best lift per exercise">
        <div className="grid gap-3 md:grid-cols-3">
          {records.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No PR data available yet.</p>
          ) : (
            records.map((pr) => (
              <article key={pr.exerciseName} className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-3">
                <p className="font-semibold">{pr.exerciseName}</p>
                <p className="text-sm text-[var(--muted)]">{pr.bestWeightKg}kg</p>
                <p className="text-xs text-[var(--muted)]">{new Date(pr.achievedAt).toLocaleDateString()}</p>
              </article>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
