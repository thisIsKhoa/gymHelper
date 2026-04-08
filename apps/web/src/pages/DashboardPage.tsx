import { Activity, Award, Calendar, Dumbbell } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer } from "../components/ui/ChartContainer.tsx";
import { Card } from "../components/ui/Card.tsx";
import { LoadingState } from "../components/ui/LoadingState.tsx";
import { apiRequest } from "../lib/api.ts";

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatShortWeek(isoWeek: string) {
  const [year, week] = isoWeek.split("-W");
  if (!week) {
    return isoWeek;
  }

  return `${year?.slice(-2)}W${week}`;
}

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
    return <LoadingState message="Loading dashboard..." cardCount={4} />;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-[var(--muted)]">No dashboard data.</p>;
  }

  const quickAccessItems = [
    { label: "Start Session", icon: Dumbbell, to: "/session" },
    { label: "Plan Week", icon: Calendar, to: "/plan" },
    { label: "View Progress", icon: Activity, to: "/progress" },
    { label: "Track PRs", icon: Award, to: "/progress" },
  ];

  return (
    <div className="grid gap-4 md:gap-5">
      <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-4">
        <Card className="p-4" title="This Week Volume">
          <p className="mt-1 text-xl font-bold sm:text-2xl">
            {data.thisWeek.totalVolume.toLocaleString()} kg
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)] sm:text-xs">
            Pre-aggregated weekly workload
          </p>
        </Card>
        <Card className="p-4" title="This Week Sessions">
          <p className="mt-1 text-xl font-bold sm:text-2xl">
            {data.thisWeek.sessionsCount}
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)] sm:text-xs">
            Training frequency target tracker
          </p>
        </Card>
        <Card className="p-4" title="Strongest Lift">
          <p className="mt-1 text-xl font-bold sm:text-2xl">
            {data.thisWeek.strongestLiftKg.toFixed(1)} kg
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)] sm:text-xs">
            Best top set in current week
          </p>
        </Card>
        <Card className="p-4" title="Current Streak">
          <p className="mt-1 text-xl font-bold sm:text-2xl">
            {data.thisWeek.streakDays} days
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)] sm:text-xs">
            Consecutive training days
          </p>
        </Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card
          title="Training Volume Trend"
          subtitle="Structured for chart visualization by date"
        >
          <div className="h-56 w-full sm:h-64">
            <ChartContainer className="h-full w-full" minHeight={220}>
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
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatShortDate}
                  minTickGap={28}
                />
                <Tooltip
                  labelFormatter={(label) => formatShortDate(String(label))}
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="var(--accent)"
                  fill="url(#volumeFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </Card>

        <Card title="PR Highlights" subtitle="Best numbers per exercise">
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 sm:max-h-none">
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
          <div className="h-56 w-full sm:h-60">
            <ChartContainer className="h-full w-full" minHeight={220}>
              <BarChart data={data.weeklySummary}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(148,163,184,0.25)"
                />
                <XAxis
                  dataKey="week"
                  tickLine={false}
                  axisLine={false}
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
          </div>
        </Card>

        <Card
          title="Frequency + Bench Context"
          subtitle="Session cadence and benchmark lift tracking"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm text-[var(--muted)]">
              Total sessions: {totalSessions}
            </p>
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm text-[var(--muted)]">
              Total volume: {totalVolume.toLocaleString()} kg
            </p>
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm text-[var(--muted)]">
              Latest bench max: {latestBench} kg
            </p>
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm text-[var(--muted)]">
              PR entries: {data.prHighlights.length}
            </p>
          </div>
        </Card>
      </div>

      <Card title="Quick Access" subtitle="Core tracking actions">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          {quickAccessItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-3 text-left transition hover:border-[var(--accent)]"
              >
                <Icon size={18} className="mb-2 text-[var(--accent)]" />
                <p className="text-sm font-semibold">{item.label}</p>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
