import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
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

interface BodyMetricInput {
  loggedAt: string;
  weightKg: number;
  bodyFatPct: number | "";
  muscleMassKg: number | "";
  notes: string;
}

interface BodyMetricPoint {
  id: string;
  loggedAt: string;
  weightKg: number;
  bodyFatPct?: number | null;
  muscleMassKg?: number | null;
  notes?: string | null;
}

interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
}

const BODY_METRICS_HISTORY_PAGE_SIZE = 30;

function sortByLoggedAtAsc(points: BodyMetricPoint[]): BodyMetricPoint[] {
  return [...points].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
  );
}

export function BodyMetricsPage() {
  const [form, setForm] = useState<BodyMetricInput>({
    loggedAt: new Date().toISOString().slice(0, 10),
    weightKg: 80,
    bodyFatPct: "",
    muscleMassKg: "",
    notes: "",
  });
  const [history, setHistory] = useState<BodyMetricPoint[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiRequest<PaginatedResponse<BodyMetricPoint>>(
        `/body-metrics/history?limit=${BODY_METRICS_HISTORY_PAGE_SIZE}&offset=0`,
        "GET",
      );
      setHistory(sortByLoggedAtAsc(result.items));
      setHistoryHasMore(result.pagination.hasMore);
      setHistoryOffset(result.pagination.nextOffset ?? result.items.length);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load body metrics",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreHistory = async () => {
    if (!historyHasMore || isLoadingMoreHistory) {
      return;
    }

    setIsLoadingMoreHistory(true);
    try {
      const result = await apiRequest<PaginatedResponse<BodyMetricPoint>>(
        `/body-metrics/history?limit=${BODY_METRICS_HISTORY_PAGE_SIZE}&offset=${historyOffset}`,
        "GET",
      );

      setHistory((current) => sortByLoggedAtAsc([...current, ...result.items]));
      setHistoryHasMore(result.pagination.hasMore);
      setHistoryOffset(
        result.pagination.nextOffset ?? historyOffset + result.items.length,
      );
    } catch {
      setStatus("Failed to load older metrics.");
    } finally {
      setIsLoadingMoreHistory(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const latest = useMemo(() => history.at(-1), [history]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    try {
      await apiRequest("/body-metrics", "POST", {
        loggedAt: form.loggedAt,
        weightKg: form.weightKg,
        bodyFatPct:
          form.bodyFatPct === "" ? undefined : Number(form.bodyFatPct),
        muscleMassKg:
          form.muscleMassKg === "" ? undefined : Number(form.muscleMassKg),
        notes: form.notes.trim() ? form.notes.trim() : undefined,
      });
      setStatus("Body metrics saved.");
      await load();
    } catch (submitError) {
      setStatus(
        submitError instanceof Error
          ? submitError.message
          : "Failed to save metric",
      );
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading body metrics..." cardCount={2} />;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  const hasHistory = history.length > 0;
  const hasCompositionData = history.some(
    (point) =>
      typeof point.bodyFatPct === "number" ||
      typeof point.muscleMassKg === "number",
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1.6fr]">
      <Card
        title="Log Body Metrics"
        subtitle="Track weight plus optional composition markers"
      >
        <form className="space-y-3" onSubmit={submit}>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Date
            </span>
            <input
              type="date"
              value={form.loggedAt}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  loggedAt: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Weight (kg)
            </span>
            <input
              type="number"
              min={20}
              max={400}
              value={form.weightKg}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  weightKg: Number(event.target.value),
                }))
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Body Fat (%) (optional)
            </span>
            <input
              type="number"
              min={2}
              max={70}
              step={0.1}
              value={form.bodyFatPct}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  bodyFatPct: event.target.value
                    ? Number(event.target.value)
                    : "",
                }))
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Muscle Mass (kg) (optional)
            </span>
            <input
              type="number"
              min={10}
              max={200}
              step={0.1}
              value={form.muscleMassKg}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  muscleMassKg: event.target.value
                    ? Number(event.target.value)
                    : "",
                }))
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Notes (optional)
            </span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              maxLength={240}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
              placeholder="Sleep, stress, hydration, or any context for this data point"
            />
          </label>

          <button
            type="submit"
            className="min-h-11 w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white sm:w-auto"
          >
            Save Metrics
          </button>

          {status ? (
            <p className="text-sm text-[var(--muted)]">{status}</p>
          ) : null}
        </form>
      </Card>

      <div className="space-y-4">
        <Card
          title="Body Metrics Progress"
          subtitle="Weight trend with optional composition overlays"
        >
          {hasHistory ? (
            <ChartContainer className="h-64 w-full" minHeight={220}>
              <LineChart data={history}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(148,163,184,0.25)"
                />
                <XAxis dataKey="loggedAt" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="weightKg"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  name="Weight (kg)"
                />
                <Line
                  type="monotone"
                  dataKey="bodyFatPct"
                  stroke="var(--accent-alt)"
                  strokeWidth={2}
                  connectNulls
                  name="Body Fat (%)"
                />
                <Line
                  type="monotone"
                  dataKey="muscleMassKg"
                  stroke="#22c55e"
                  strokeWidth={2}
                  connectNulls
                  name="Muscle Mass (kg)"
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-6 text-sm text-[var(--muted)]">
              No body metric data yet. Save your first entry to start tracking.
            </p>
          )}

          {hasHistory ? (
            <button
              type="button"
              onClick={() => void loadMoreHistory()}
              disabled={!historyHasMore || isLoadingMoreHistory}
              className="mt-3 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMoreHistory
                ? "Loading older entries..."
                : historyHasMore
                  ? "Load older entries"
                  : "All loaded"}
            </button>
          ) : null}
        </Card>

        {hasHistory && !hasCompositionData ? (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-3 text-sm text-[var(--muted)]">
            Composition fields are optional. Add body fat or muscle mass when
            available for deeper trend analysis.
          </p>
        ) : null}

        {latest ? (
          <Card title="Latest Snapshot" subtitle="Most recent measurement">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[var(--border)] p-3">
                <p className="text-[var(--muted)]">Weight</p>
                <p className="text-lg font-semibold">{latest.weightKg} kg</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-3">
                <p className="text-[var(--muted)]">Date</p>
                <p className="text-lg font-semibold">
                  {new Date(latest.loggedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-3">
                <p className="text-[var(--muted)]">Body Fat</p>
                <p className="text-lg font-semibold">
                  {typeof latest.bodyFatPct === "number"
                    ? `${latest.bodyFatPct}%`
                    : "-"}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-3">
                <p className="text-[var(--muted)]">Muscle Mass</p>
                <p className="text-lg font-semibold">
                  {typeof latest.muscleMassKg === "number"
                    ? `${latest.muscleMassKg} kg`
                    : "-"}
                </p>
              </div>
            </div>

            {latest.notes ? (
              <div className="mt-3 rounded-xl border border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                <p className="mb-1 text-xs uppercase tracking-[0.14em]">
                  Notes
                </p>
                <p>{latest.notes}</p>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
