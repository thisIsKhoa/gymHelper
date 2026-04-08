import { Activity, Award, Calendar, Dumbbell } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "../components/ui/Card.tsx";
import { apiRequest } from "../lib/api.ts";

interface DashboardOverview {
  volumeTrend: Array<{ date: string; volume: number }>;
  workoutFrequency: Array<{ week: string; sessionsCount: number }>;
  benchProgressByWeek: Array<{ week: string; maxWeightKg: number }>;
  weeklySummary: Array<{
    week: string;
    totalVolume: number;
    sessionsCount: number;
    strongestLiftKg: number;
  }>;
  prHighlights: Array<{
    exerciseName: string;
    bestWeightKg: number;
    bestVolume: number;
    achievedAt: string;
  }>;
  thisWeek: {
    week: string;
    totalVolume: number;
    sessionsCount: number;
    strongestLiftKg: number;
    streakDays: number;
  };
  latestBodyMetric?: {
    weightKg: number;
    bodyFatPct?: number | null;
    muscleMassKg?: number | null;
  } | null;
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiRequest<DashboardOverview>(
          "/dashboard/overview",
          "GET",
        );
        setData(result);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load dashboard",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const totalVolume = useMemo(() => {
    if (!data) {
      return 0;
    }
    return data.volumeTrend.reduce((acc, point) => acc + point.volume, 0);
  }, [data]);

  const totalSessions = useMemo(() => {
    if (!data) {
      return 0;
    }
    return data.weeklySummary.reduce(
      (acc, point) => acc + point.sessionsCount,
      0,
    );
  }, [data]);

  const latestBench = data?.benchProgressByWeek.at(-1)?.maxWeightKg ?? 0;

  if (isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading dashboard...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-[var(--muted)]">No dashboard data.</p>;
  }

  return (
    <div className="grid gap-4 md:gap-5">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4" title="This Week Volume">
          <p className="mt-2 text-2xl font-bold">
            {data.thisWeek.totalVolume.toLocaleString()} kg
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Pre-aggregated weekly workload
          </p>
        </Card>
        <Card className="p-4" title="This Week Sessions">
          <p className="mt-2 text-2xl font-bold">
            {data.thisWeek.sessionsCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Training frequency target tracker
          </p>
        </Card>
        <Card className="p-4" title="Strongest Lift">
          <p className="mt-2 text-2xl font-bold">
            {data.thisWeek.strongestLiftKg.toFixed(1)} kg
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Best top set in current week
          </p>
        </Card>
        <Card className="p-4" title="Current Streak">
          <p className="mt-2 text-2xl font-bold">
            {data.thisWeek.streakDays} days
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Consecutive training days
          </p>
        </Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card
          title="Training Volume Trend"
          subtitle="Structured for chart visualization by date"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <AreaChart data={data.volumeTrend}>
                <defs>
                  <linearGradient id="volumeFill" x1="0" x2="0" y1="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--accent)"
                      stopOpacity={0.6}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--accent)"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(148,163,184,0.25)"
                />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="var(--accent)"
                  fill="url(#volumeFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="PR Highlights" subtitle="Best numbers per exercise">
          <ul className="space-y-2">
            {data.prHighlights.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">No PR yet.</li>
            ) : (
              data.prHighlights.slice(0, 6).map((record) => (
                <li
                  key={record.exerciseName}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-3"
                >
                  <p className="font-semibold text-[var(--text)]">
                    {record.exerciseName}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {record.bestWeightKg}kg · Vol {record.bestVolume.toFixed(0)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {new Date(record.achievedAt).toLocaleDateString()}
                  </p>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Weekly Volume"
          subtitle="Fast rendering from pre-aggregated stats"
        >
          <div className="h-60 w-full">
            <ResponsiveContainer>
              <BarChart data={data.weeklySummary}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(148,163,184,0.25)"
                />
                <XAxis dataKey="week" tickLine={false} axisLine={false} />
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
          title="Frequency + Bench Context"
          subtitle="Session cadence and benchmark lift tracking"
        >
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Total tracked sessions: {totalSessions}
            </p>
            <p className="text-sm text-[var(--muted)]">
              Tracked total volume: {totalVolume.toLocaleString()} kg
            </p>
            <p className="text-sm text-[var(--muted)]">
              Latest bench weekly max: {latestBench} kg
            </p>
            <p className="text-sm text-[var(--muted)]">
              Tracked PR entries: {data.prHighlights.length}
            </p>
          </div>
        </Card>
      </div>

      <Card title="Quick Access" subtitle="Core tracking actions">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Start Session", icon: Dumbbell },
            { label: "Plan Week", icon: Calendar },
            { label: "View Progress", icon: Activity },
            { label: "Track PRs", icon: Award },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-3 text-left"
              >
                <Icon size={18} className="mb-2 text-[var(--accent)]" />
                <p className="text-sm font-semibold">{item.label}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
