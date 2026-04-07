import { useEffect, useMemo, useState } from "react";
import {
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

interface BodyMetricInput {
  loggedAt: string;
  weightKg: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
}

interface BodyMetricPoint {
  id: string;
  loggedAt: string;
  weightKg: number;
  bodyFatPct?: number | null;
  muscleMassKg?: number | null;
}

export function BodyMetricsPage() {
  const [form, setForm] = useState<BodyMetricInput>({
    loggedAt: new Date().toISOString().slice(0, 10),
    weightKg: 80,
    bodyFatPct: undefined,
    muscleMassKg: undefined,
  });
  const [history, setHistory] = useState<BodyMetricPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiRequest<BodyMetricPoint[]>("/body-metrics/history", "GET");
      setHistory(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load body metrics");
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
        bodyFatPct: form.bodyFatPct,
        muscleMassKg: form.muscleMassKg,
      });
      setStatus("Body metric saved.");
      await load();
    } catch (submitError) {
      setStatus(submitError instanceof Error ? submitError.message : "Failed to save metric");
    }
  };

  if (isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading body metrics...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1.6fr]">
      <Card title="Log Body Metrics" subtitle="Cloud-synced body composition tracking">
        <form className="space-y-3" onSubmit={submit}>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Date</span>
            <input
              type="date"
              value={form.loggedAt}
              onChange={(event) => setForm((current) => ({ ...current, loggedAt: event.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Weight (kg)</span>
            <input
              type="number"
              min={20}
              max={400}
              value={form.weightKg}
              onChange={(event) => setForm((current) => ({ ...current, weightKg: Number(event.target.value) }))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Body Fat % (optional)</span>
            <input
              type="number"
              min={2}
              max={70}
              value={form.bodyFatPct ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  bodyFatPct: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Muscle Mass (kg, optional)</span>
            <input
              type="number"
              min={10}
              max={200}
              value={form.muscleMassKg ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  muscleMassKg: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            />
          </label>

          <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
            Save Metric
          </button>

          {status ? <p className="text-sm text-[var(--muted)]">{status}</p> : null}
        </form>
      </Card>

      <div className="space-y-4">
        <Card title="Body Weight Progress" subtitle="Trend over time from cloud DB">
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="loggedAt" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="weightKg" stroke="var(--accent)" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Composition Trend" subtitle="Body fat % and muscle mass">
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="loggedAt" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="bodyFatPct" stroke="#f97316" strokeWidth={2} />
                <Line type="monotone" dataKey="muscleMassKg" stroke="#14b8a6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {latest ? (
          <Card title="Latest Snapshot" subtitle="Most recent measurement">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border border-[var(--border)] p-3">
                <p className="text-[var(--muted)]">Weight</p>
                <p className="text-lg font-semibold">{latest.weightKg} kg</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-3">
                <p className="text-[var(--muted)]">Body Fat</p>
                <p className="text-lg font-semibold">{latest.bodyFatPct ?? "-"}%</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-3">
                <p className="text-[var(--muted)]">Muscle</p>
                <p className="text-lg font-semibold">{latest.muscleMassKg ?? "-"} kg</p>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
