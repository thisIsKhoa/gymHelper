import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Card } from "../components/ui/Card.tsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue.ts";
import { apiRequest } from "../lib/api.ts";
import { QUERY_GC_MS, QUERY_STALE_MS } from "../lib/query-config.ts";
import { queryKeys } from "../lib/query-keys.ts";
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

function toExerciseQueryPath(search: string): string {
  const normalized = search.trim();

  if (!normalized) {
    return "/exercises";
  }

  return `/exercises?search=${encodeURIComponent(normalized)}`;
}

export function ExerciseLibraryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState<CustomExerciseForm>({
    name: "",
    muscleGroup: "CHEST",
    exerciseType: "ISOLATION",
    defaultRestSeconds: 90,
  });

  const normalizedSearch = search.trim();
  const debouncedSearch = useDebouncedValue(normalizedSearch, 250);

  const exercisesQuery = useQuery({
    queryKey: queryKeys.exerciseLibrary(debouncedSearch),
    queryFn: () =>
      apiRequest<ExerciseLibraryItem[]>(
        toExerciseQueryPath(debouncedSearch),
        "GET",
      ),
    staleTime: QUERY_STALE_MS.long,
    gcTime: QUERY_GC_MS.long,
    refetchOnWindowFocus: false,
  });

  const createExerciseMutation = useMutation({
    mutationFn: (payload: CustomExerciseForm) =>
      apiRequest("/exercises", "POST", payload),
    onSuccess: async () => {
      setStatus("Custom exercise added.");
      setForm((current) => ({
        ...current,
        name: "",
      }));

      await queryClient.invalidateQueries({
        queryKey: queryKeys.exerciseLibraryBase,
      });
    },
    onError: (error) => {
      setStatus(
        error instanceof Error
          ? error.message
          : "Failed to add custom exercise.",
      );
    },
  });

  const items = exercisesQuery.data ?? [];

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
      await createExerciseMutation.mutateAsync(form);
    } catch {
      // Errors are surfaced via mutation onError and status state.
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
            <span className="ui-label">Exercise Name</span>
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              required
              className="ui-input"
              placeholder="e.g. Deficit Deadlift"
            />
          </label>

          <label className="block">
            <span className="ui-label">Muscle Group</span>
            <select
              value={form.muscleGroup}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  muscleGroup: event.target
                    .value as CustomExerciseForm["muscleGroup"],
                }))
              }
              className="ui-select"
            >
              {muscleGroupOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="ui-label">Exercise Type</span>
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
              className="ui-select"
            >
              {exerciseTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="ui-label">Default Rest (seconds)</span>
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
              className="ui-input"
            />
          </label>

          <button
            type="submit"
            disabled={createExerciseMutation.isPending}
            className="ui-btn ui-btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto"
          >
            <Plus size={16} />
            {createExerciseMutation.isPending ? "Adding..." : "Add Exercise"}
          </button>
        </form>

        {status ? <p className="ui-status mt-3">{status}</p> : null}
      </Card>

      <div className="space-y-4">
        <Card
          title="Exercise Library"
          subtitle="Predefined and custom movements for workout logging"
          action={
            <label className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl border border-(--border) bg-(--surface-solid) px-3 py-1.5 text-sm text-(--muted) sm:w-auto">
              <Search size={14} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent outline-none sm:w-28"
                placeholder="Search"
              />
            </label>
          }
        >
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {groupedCount.map(([group, count]) => (
              <span key={group} className="ui-chip">
                {group.replaceAll("_", " ")} · {count}
              </span>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article key={item.id} className="ui-tile p-3">
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="mt-1 text-xs text-(--muted)">
                  {item.muscleGroup.replaceAll("_", " ")} · {item.exerciseType}
                </p>
                <p className="mt-1 text-xs text-(--muted)">
                  Rest {item.defaultRestSeconds}s
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-(--muted)">
                  {item.source}
                </p>
              </article>
            ))}

            {exercisesQuery.isLoading ? (
              <p className="ui-empty-state text-sm">Loading exercises...</p>
            ) : null}

            {!exercisesQuery.isLoading && items.length === 0 ? (
              <p className="ui-empty-state text-sm">No exercises found.</p>
            ) : null}
          </div>

          {exercisesQuery.error ? (
            <p className="ui-status ui-status-danger mt-3">
              {exercisesQuery.error instanceof Error
                ? exercisesQuery.error.message
                : "Failed to load exercise library."}
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
