import { useEffect, useMemo, useState } from "react";
import {
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

interface BodyMetricInput {
  loggedAt: string;
  weightKg: number;
}

interface BodyMetricPoint {
  id: string;
  loggedAt: string;
  weightKg: number;
}

export function BodyMetricsPage() {
  const [form, setForm] = useState<BodyMetricInput>({
    loggedAt: new Date().toISOString().slice(0, 10),
    weightKg: 80,
  });
  const [history, setHistory] = useState<BodyMetricPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiRequest<BodyMetricPoint[]>(
        "/body-metrics/history",
        "GET",
      );
      setHistory(result);
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
      });
      setStatus("Weight saved.");
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

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1.6fr]">
      <Card title="Log Weight" subtitle="Track body weight only">
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

          <button
            type="submit"
            className="min-h-11 w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white sm:w-auto"
          >
            Save Weight
          </button>

          {status ? (
            <p className="text-sm text-[var(--muted)]">{status}</p>
          ) : null}
        </form>
      </Card>

      <div className="space-y-4">
        <Card title="Body Weight Progress" subtitle="Trend over time">
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
                <Line
                  type="monotone"
                  dataKey="weightKg"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-6 text-sm text-[var(--muted)]">
              Chua co du lieu can nang. Hay luu ban ghi dau tien de bat dau theo
              doi.
            </p>
          )}
        </Card>

        {latest ? (
          <Card title="Latest Snapshot" subtitle="Most recent measurement">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
