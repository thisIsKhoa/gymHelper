import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card } from "../components/ui/Card.tsx";
import { apiRequest } from "../lib/api.ts";
import type { ExerciseLibraryItem } from "../types/workout.ts";

const muscleGroupOptions = [
  "CHEST",
  "BACK",
  "LEGS",
  "SHOULDERS",
  "ARMS",
  "CORE",
  "GLUTES",
  "FULL_BODY",
] as const;

const exerciseTypeOptions = ["COMPOUND", "ISOLATION"] as const;

interface CustomExerciseForm {
  name: string;
  muscleGroup: (typeof muscleGroupOptions)[number];
  exerciseType: (typeof exerciseTypeOptions)[number];
  defaultRestSeconds: number;
}

export function ExerciseLibraryPage() {
  const [items, setItems] = useState<ExerciseLibraryItem[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState<CustomExerciseForm>({
    name: "",
    muscleGroup: "CHEST",
    exerciseType: "ISOLATION",
    defaultRestSeconds: 90,
  });

  const load = async () => {
    try {
      const query = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";
      const result = await apiRequest<ExerciseLibraryItem[]>(
        `/exercises${query}`,
        "GET",
      );
      setItems(result);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Failed to load exercise library.",
      );
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const groupedCount = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of items) {
      map.set(item.muscleGroup, (map.get(item.muscleGroup) ?? 0) + 1);
    }

    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    try {
      await apiRequest("/exercises", "POST", form);
      setStatus("Custom exercise added.");
      setForm((current) => ({
        ...current,
        name: "",
      }));
      await load();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Failed to add custom exercise.",
      );
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_1.8fr]">
      <Card
        title="Add Custom Exercise"
        subtitle="Tag by muscle group and exercise type"
      >
        <form className="space-y-3" onSubmit={submit}>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Exercise Name
            </span>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              required
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
              placeholder="e.g. Deficit Deadlift"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Muscle Group
            </span>
            <select
              value={form.muscleGroup}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  muscleGroup: event.target
                    .value as CustomExerciseForm["muscleGroup"],
                }))
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            >
              {muscleGroupOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Exercise Type
            </span>
            <select
              value={form.exerciseType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  exerciseType: event.target
                    .value as CustomExerciseForm["exerciseType"],
                  defaultRestSeconds:
                    event.target.value === "COMPOUND" ? 150 : 90,
                }))
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            >
              {exerciseTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Default Rest (seconds)
            </span>
            <input
              type="number"
              min={45}
              max={300}
              value={form.defaultRestSeconds}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  defaultRestSeconds: Number(event.target.value),
                }))
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            />
          </label>

          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white sm:w-auto"
          >
            <Plus size={16} /> Add Exercise
          </button>
        </form>

        {status ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{status}</p>
        ) : null}
      </Card>

      <div className="space-y-4">
        <Card
          title="Exercise Library"
          subtitle="Predefined and custom movements for workout logging"
          action={
            <label className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-1.5 text-sm text-[var(--muted)] sm:w-auto">
              <Search size={14} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onBlur={() => void load()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void load();
                  }
                }}
                className="w-full bg-transparent outline-none sm:w-28"
                placeholder="Search"
              />
            </label>
          }
        >
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {groupedCount.map(([group, count]) => (
              <span
                key={group}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--muted)]"
              >
                {group.replaceAll("_", " ")} · {count}
              </span>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-3"
              >
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {item.muscleGroup.replaceAll("_", " ")} · {item.exerciseType}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Rest {item.defaultRestSeconds}s
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
                  {item.source}
                </p>
              </article>
            ))}
            {items.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No exercises found.</p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
