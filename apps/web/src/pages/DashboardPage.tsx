import {
  Activity,
  Award,
  Calendar,
  Dumbbell,
  Medal,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { QUERY_GC_MS, QUERY_STALE_MS } from "../lib/query-config.ts";
import { queryKeys } from "../lib/query-keys.ts";

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

function formatMediumDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function categoryLabel(
  category: DashboardOverview["completedAchievements"][number]["category"],
) {
  switch (category) {
    case "volume":
      return "Volume";
    case "consistency":
      return "Consistency";
    case "pr":
      return "Strength";
    case "hidden":
      return "Secret";
    default:
      return "Achievement";
  }
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
            bg-linear-to-r from-red-500 via-orange-400 to-yellow-400
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
  completedAchievements: Array<{
    code: string;
    title: string;
    description: string;
    iconKey: string;
    category: "volume" | "consistency" | "pr" | "hidden";
    unlockedAt: string;
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

type HighlightsTab = "achievements" | "pr";

export function DashboardPage() {
  const [highlightsTab, setHighlightsTab] =
    useState<HighlightsTab>("achievements");
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboardOverview,
    queryFn: () => apiRequest<DashboardOverview>("/dashboard/overview", "GET"),
    staleTime: QUERY_STALE_MS.medium,
    gcTime: QUERY_GC_MS.long,
    refetchOnWindowFocus: false,
  });

  const data = dashboardQuery.data;

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
  const completedAchievements = data?.completedAchievements ?? [];

  if (dashboardQuery.isLoading) {
    return <LoadingState message="Loading dashboard..." cardCount={4} />;
  }

  if (dashboardQuery.error) {
    const errorMessage =
      dashboardQuery.error instanceof Error
        ? dashboardQuery.error.message
        : "Failed to load dashboard";

    return <p className="ui-status ui-status-danger">{errorMessage}</p>;
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
      <section className="order-2 glass-card p-4 sm:p-5 md:order-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-(--muted) sm:text-xs">
              Weekly Snapshot
            </p>
            <h2 className="mt-1 text-xl font-bold text-(--text) sm:text-2xl">
              Keep Your Training Signal Consistent
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-(--muted)">
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
                <Icon size={16} className="text-(--accent)" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="order-first grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 md:order-0 md:grid-cols-4">
        {metricTiles.map((tile) => {
          const Icon = tile.icon;

          return (
            <Card key={tile.title} className="ui-kpi p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-(--text)">
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
                      stopColor="var(--chart-primary)"
                      stopOpacity={0.6}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--chart-primary)"
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
                  stroke="var(--chart-primary)"
                  fill="url(#volumeFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </Card>

        <Card
          title="Highlights"
          className="flex min-h-84 max-h-[70vh] flex-col p-4 sm:min-h-92 sm:max-h-128 sm:p-5 md:p-5"
        >
          <div
            role="tablist"
            aria-label="Dashboard highlights"
            className="ui-panel mb-3 grid grid-cols-2 gap-1.5 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={highlightsTab === "achievements"}
              onClick={() => setHighlightsTab("achievements")}
              className={`relative rounded-lg border px-2.5 py-1.5 pr-9 text-left transition-all ${
                highlightsTab === "achievements"
                  ? "border-amber-300 bg-[linear-gradient(145deg,rgba(252,211,77,0.32),rgba(253,230,138,0.18))] text-amber-950 shadow-[0_8px_20px_rgba(245,158,11,0.18)]"
                  : "border-transparent text-(--muted) hover:border-(--border)"
              }`}
            >
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em]">
                <Medal size={12} />
                Achieve
              </span>
              <p className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base font-bold leading-none">
                {completedAchievements.length}
              </p>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={highlightsTab === "pr"}
              onClick={() => setHighlightsTab("pr")}
              className={`relative rounded-lg border px-2.5 py-1.5 pr-9 text-left transition-all ${
                highlightsTab === "pr"
                  ? "border-[color-mix(in oklab,var(--accent) 36%,var(--border))] bg-[color-mix(in oklab,var(--accent) 16%,transparent)] text-(--text) shadow-[0_8px_20px_rgba(16,185,129,0.14)]"
                  : "border-transparent text-(--muted) hover:border-(--border)"
              }`}
            >
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em]">
                <TrendingUp size={12} className="text-(--chart-trend-up)" />
                PR Highlights
              </span>
              <p className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base font-bold leading-none">
                {prHighlights.length}
              </p>
            </button>
          </div>

          {highlightsTab === "achievements" ? (
            <ul className="ui-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5">
              {completedAchievements.length === 0 ? (
                <li className="rounded-xl border border-dashed border-amber-300/60 bg-amber-100/30 px-3 py-3 text-sm text-amber-900/80">
                  No completed achievements yet. Keep training to unlock your
                  first trophy.
                </li>
              ) : (
                completedAchievements.map((achievement, index) => (
                  <li
                    key={`${achievement.code}-${achievement.unlockedAt}-${index}`}
                    className="relative overflow-hidden rounded-xl border border-amber-300/80 bg-[linear-gradient(150deg,rgba(253,230,138,0.34),rgba(254,243,199,0.18))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                  >
                    <div className="pointer-events-none absolute -right-8 -top-10 h-20 w-20 rounded-full bg-amber-300/35 blur-2xl" />
                    <div className="relative flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-semibold leading-tight text-(--text)">
                          {achievement.title}
                        </p>
                        <p className="mt-1 text-sm leading-snug text-(--text)/78">
                          {achievement.description}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                        <span className="inline-flex items-center gap-1">
                          <Sparkles size={11} />
                          Unlocked
                        </span>
                      </span>
                    </div>

                    <div className="relative mt-2.5 flex items-center justify-between gap-2 text-xs">
                      <span className="rounded-full border border-amber-300/90 bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">
                        {categoryLabel(achievement.category)}
                      </span>
                      <span className="text-(--text)/70">
                        {formatMediumDate(achievement.unlockedAt)}
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          ) : (
            <ul className="ui-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5">
              {prHighlights.length === 0 ? (
                <li className="rounded-xl border border-dashed border-(--border) px-3 py-3 text-sm text-(--muted)">
                  No PR yet.
                </li>
              ) : (
                prHighlights.map((record, index) => (
                  <li
                    key={`${record.exerciseName}-${record.achievedAt}-${index}`}
                    className="ui-tile p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-(--text)">
                        {record.exerciseName}
                      </p>
                      <span className="rounded-full border border-[color-mix(in oklab,var(--accent) 38%,var(--border))] bg-[color-mix(in oklab,var(--accent) 12%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-(--text)">
                        PR
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="rounded-full border border-(--border) bg-[color-mix(in oklab,var(--surface) 92%,black)] px-2 py-0.5 text-(--text)">
                        Top {record.bestWeightKg} kg
                      </span>
                      <span className="rounded-full border border-(--border) bg-[color-mix(in oklab,var(--surface) 92%,black)] px-2 py-0.5 text-(--text)">
                        Vol {record.bestVolume.toFixed(0)}
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs text-(--muted)">
                      Updated {formatMediumDate(record.achievedAt)}
                    </p>
                  </li>
                ))
              )}
            </ul>
          )}
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
                  fill="var(--chart-primary)"
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
            <p className="ui-tile px-3 py-2 text-sm text-(--muted)">
              Total sessions: <CountUpValue value={totalSessions} />
            </p>
            <p className="ui-tile px-3 py-2 text-sm text-(--muted)">
              Total volume: <CountUpValue value={totalVolume} suffix=" kg" />
            </p>
            <p className="ui-tile px-3 py-2 text-sm text-(--muted)">
              Latest bench max:{" "}
              <CountUpValue value={latestBench} decimals={1} suffix=" kg" />
            </p>
            <p className="ui-tile px-3 py-2 text-sm text-(--muted)">
              Completed achievements:{" "}
              <CountUpValue value={completedAchievements.length} />
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
