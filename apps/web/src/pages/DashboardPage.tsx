import { Activity, Award, Calendar, Dumbbell } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

interface CountUpValueProps {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
  durationMs?: number;
}

function CountUpValue({
  value,
  decimals = 0,
  suffix = "",
  className,
  durationMs = 1900,
}: CountUpValueProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isFinishFlash, setIsFinishFlash] = useState(false);
  const finishTimeoutRef = useRef<number | null>(null);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [decimals],
  );

  useEffect(() => {
    if (finishTimeoutRef.current) {
      window.clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplayValue(value);
      setIsFinishFlash(false);
      return;
    }

    let frameId = 0;
    const startAt = performance.now();

    const tick = (timestamp: number) => {
      const progress = Math.min((timestamp - startAt) / durationMs, 1);

      if (progress >= 1) {
        setDisplayValue(value);
        setIsFinishFlash(true);
        finishTimeoutRef.current = window.setTimeout(() => {
          setIsFinishFlash(false);
          finishTimeoutRef.current = null;
        }, 560);
        return;
      }

      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * easedProgress);
      frameId = window.requestAnimationFrame(tick);
    };

    setDisplayValue(0);
    setIsFinishFlash(false);
    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      if (finishTimeoutRef.current) {
        window.clearTimeout(finishTimeoutRef.current);
        finishTimeoutRef.current = null;
      }
    };
  }, [durationMs, value]);

  return (
    <span
      className={`
      ${className ?? ""}
      inline-block
      transform-gpu
      will-change-transform
      transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]
      ${
        isFinishFlash
          ? `
            scale-[1.05]
            text-transparent
            bg-clip-text
            bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400
            countup-finish-glow
            drop-shadow-[0_0_20px_rgba(255,120,0,0.55)]
          `
          : ""
      }
    `.trim()}
    >
      {formatter.format(displayValue)}
      {suffix}
    </span>
  );
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
  const prHighlights = data?.prHighlights ?? [];

  if (isLoading) {
    return <LoadingState message="Loading dashboard..." cardCount={4} />;
  }

  if (error) {
    return <p className="ui-status ui-status-danger">{error}</p>;
  }

  if (!data) {
    return <p className="ui-status">No dashboard data.</p>;
  }

  const quickAccessItems = [
    { label: "Start Session", icon: Dumbbell, to: "/session" },
    { label: "Plan Week", icon: Calendar, to: "/plan" },
    { label: "View Progress", icon: Activity, to: "/progress" },
    { label: "Track PRs", icon: Award, to: "/progress" },
  ];

  const metricTiles = [
    {
      title: "This Week Volume",
      value: data.thisWeek.totalVolume,
      decimals: 0,
      suffix: " kg",
      note: "Pre-aggregated weekly workload",
      icon: Activity,
    },
    {
      title: "This Week Sessions",
      value: data.thisWeek.sessionsCount,
      decimals: 0,
      note: "Training frequency tracker",
      icon: Calendar,
    },
    {
      title: "Strongest Lift",
      value: data.thisWeek.strongestLiftKg,
      decimals: 1,
      suffix: " kg",
      note: "Best top set in current week",
      icon: Dumbbell,
    },
    {
      title: "Current Streak",
      value: data.thisWeek.streakDays,
      decimals: 0,
      suffix: " days",
      note: "Consecutive training days",
      icon: Award,
    },
  ];

  return (
    <div className="grid gap-4 md:gap-5">
      <section className="order-2 glass-card p-4 sm:p-5 md:order-none">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)] sm:text-xs">
              Weekly Snapshot
            </p>
            <h2 className="mt-1 text-xl font-bold text-[var(--text)] sm:text-2xl">
              Keep Your Training Signal Consistent
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              This view combines volume, frequency, and PR data so you can spot
              momentum early and adjust your next session with confidence.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="ui-chip">Week {data.thisWeek.week}</span>
            <span className="ui-chip">
              Total sessions:{" "}
              <CountUpValue value={data.thisWeek.sessionsCount} />
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
          {quickAccessItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                className="ui-btn ui-btn-secondary inline-flex items-center justify-start gap-2"
              >
                <Icon size={16} className="text-[var(--accent)]" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="order-first grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 md:order-none md:grid-cols-4">
        {metricTiles.map((tile) => {
          const Icon = tile.icon;

          return (
            <Card key={tile.title} className="ui-kpi p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--text)]">
                  {tile.title}
                </p>
                <span className="ui-chip">
                  <Icon size={14} />
                </span>
              </div>
              <CountUpValue
                className="ui-kpi-value"
                value={tile.value}
                decimals={tile.decimals}
                suffix={tile.suffix}
              />
              <p className="ui-kpi-label">{tile.note}</p>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
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

        <Card title="PR Highlights" subtitle="Scrollable list">
          <ul className="max-h-[17.25rem] space-y-2 overflow-y-auto pr-1">
            {prHighlights.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">No PR yet.</li>
            ) : (
              prHighlights.map((record, index) => (
                <li
                  key={`${record.exerciseName}-${record.achievedAt}-${index}`}
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
              Total sessions: <CountUpValue value={totalSessions} />
            </p>
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm text-[var(--muted)]">
              Total volume: <CountUpValue value={totalVolume} suffix=" kg" />
            </p>
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm text-[var(--muted)]">
              Latest bench max:{" "}
              <CountUpValue value={latestBench} decimals={1} suffix=" kg" />
            </p>
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm text-[var(--muted)]">
              PR entries: <CountUpValue value={data.prHighlights.length} />
            </p>
          </div>
        </Card>
      </div>

      <Card
        title="Focus Signals"
        subtitle="Use these quick checks to plan your next training block"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <p className="ui-status">
            Weekly frequency trend: <CountUpValue value={totalSessions} /> total
            sessions tracked
          </p>
          <p className="ui-status">
            Volume baseline: <CountUpValue value={totalVolume} suffix=" kg" />{" "}
            across visible period
          </p>
          <p className="ui-status">
            Latest benchmark bench:{" "}
            <CountUpValue value={latestBench} decimals={1} suffix=" kg" />
          </p>
        </div>
      </Card>
    </div>
  );
}
