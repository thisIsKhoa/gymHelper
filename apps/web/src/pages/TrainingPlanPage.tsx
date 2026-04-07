import { CopyPlus, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card } from "../components/ui/Card.tsx";
import { apiRequest } from "../lib/api.ts";

interface PlanDay {
  dayOfWeek: number;
  focus: string;
  exercises: string;
  restSeconds: number;
}

interface ApiPlan {
  id: string;
  name: string;
  days: Array<{
    dayOfWeek: number;
    focus: string;
    exercises: unknown;
  }>;
}

const defaultDays: PlanDay[] = [
  {
    dayOfWeek: 1,
    focus: "Push",
    exercises: "Bench Press, Overhead Press, Incline DB Press",
    restSeconds: 120,
  },
  {
    dayOfWeek: 3,
    focus: "Pull",
    exercises: "Barbell Row, Pull Up, Face Pull",
    restSeconds: 90,
  },
  {
    dayOfWeek: 5,
    focus: "Legs",
    exercises: "Back Squat, Romanian Deadlift, Leg Press",
    restSeconds: 150,
  },
];

const reusableTemplates = [
  {
    name: "Push / Pull / Legs",
    days: defaultDays,
  },
  {
    name: "Upper / Lower",
    days: [
      {
        dayOfWeek: 1,
        focus: "Upper",
        exercises: "Bench Press, Row, Shoulder Press",
        restSeconds: 120,
      },
      {
        dayOfWeek: 3,
        focus: "Lower",
        exercises: "Back Squat, Deadlift, Lunges",
        restSeconds: 150,
      },
      {
        dayOfWeek: 5,
        focus: "Upper",
        exercises: "Incline Bench, Pulldown, Lateral Raise",
        restSeconds: 90,
      },
      {
        dayOfWeek: 6,
        focus: "Lower",
        exercises: "Front Squat, Hip Thrust, Ham Curl",
        restSeconds: 120,
      },
    ],
  },
];

function parseExerciseList(raw: unknown): string {
  if (!Array.isArray(raw)) {
    return "";
  }

  return raw
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return "";
      }

      const value = (item as { exerciseName?: unknown }).exerciseName;
      return typeof value === "string" ? value : "";
    })
    .filter(Boolean)
    .join(", ");
}

export function TrainingPlanPage() {
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [planName, setPlanName] = useState("Personal Plan");
  const [days, setDays] = useState<PlanDay[]>(defaultDays);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  const totalExercises = useMemo(() => {
    return days.reduce(
      (acc, day) =>
        acc +
        day.exercises
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean).length,
      0,
    );
  }, [days]);

  const loadPlans = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiRequest<ApiPlan[]>("/plans", "GET");
      setPlans(result);

      const first = result[0];
      if (first) {
        setCurrentPlanId(first.id);
        setPlanName(first.name);
        setDays(
          first.days.map((day) => ({
            dayOfWeek: day.dayOfWeek,
            focus: day.focus,
            exercises: parseExerciseList(day.exercises),
            restSeconds: 90,
          })),
        );
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load plans");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const updateDay = (index: number, patch: Partial<PlanDay>) => {
    setDays((current) =>
      current.map((day, currentIndex) =>
        currentIndex === index ? { ...day, ...patch } : day,
      ),
    );
  };

  const buildPayload = () => ({
    name: planName,
    days: days.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      focus: day.focus,
      exercises: day.exercises
        .split(",")
        .map((exerciseName) => exerciseName.trim())
        .filter(Boolean)
        .map((exerciseName) => ({
          exerciseName,
          sets: 4,
          reps: 8,
        })),
    })),
  });

  const savePlan = async () => {
    setIsSaving(true);
    setStatus(null);

    try {
      if (currentPlanId) {
        await apiRequest(`/plans/${currentPlanId}`, "PUT", buildPayload());
        setStatus("Plan updated.");
      } else {
        const created = await apiRequest<{ id: string }>("/plans", "POST", buildPayload());
        setCurrentPlanId(created.id);
        setStatus("Plan created.");
      }

      await loadPlans();
    } catch (saveError) {
      setStatus(saveError instanceof Error ? saveError.message : "Failed to save plan");
    } finally {
      setIsSaving(false);
    }
  };

  const duplicatePlan = async () => {
    if (!currentPlanId) {
      setStatus("Please create/save the plan first before duplicating.");
      return;
    }

    setIsSaving(true);
    setStatus(null);

    try {
      const duplicated = await apiRequest<{ id: string; name: string }>(
        `/plans/${currentPlanId}/duplicate`,
        "POST",
        { name: `${planName} Copy` },
      );
      setCurrentPlanId(duplicated.id);
      setPlanName(duplicated.name);
      setStatus("Plan duplicated.");
      await loadPlans();
    } catch (duplicateError) {
      setStatus(duplicateError instanceof Error ? duplicateError.message : "Failed to duplicate plan");
    } finally {
      setIsSaving(false);
    }
  };

  const selectPlan = (planId: string) => {
    const selected = plans.find((plan) => plan.id === planId);
    if (!selected) {
      return;
    }

    setCurrentPlanId(selected.id);
    setPlanName(selected.name);
    setDays(
      selected.days.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        focus: day.focus,
        exercises: parseExerciseList(day.exercises),
        restSeconds: 90,
      })),
    );
  };

  const applyTemplate = (templateIndex: number) => {
    const template = reusableTemplates[templateIndex];
    if (!template) {
      return;
    }

    setCurrentPlanId(null);
    setPlanName(template.name);
    setDays(template.days);
    setStatus(`Template applied: ${template.name}`);
  };

  if (isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading plans...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card title="Custom Training Schedule" subtitle="Create, edit, and reuse weekly plans">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Existing Plans</span>
            <select
              value={currentPlanId ?? ""}
              onChange={(event) => selectPlan(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            >
              <option value="">New Plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Plan Name</span>
            <input
              value={planName}
              onChange={(event) => setPlanName(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            />
          </label>

          <div className="grid gap-3">
            {days.map((day, index) => (
              <article key={`${day.dayOfWeek}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-3">
                <div className="mb-2 grid gap-2 md:grid-cols-3">
                  <label>
                    <span className="mb-1 block text-xs text-[var(--muted)]">Day of Week</span>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={day.dayOfWeek}
                      onChange={(event) => updateDay(index, { dayOfWeek: Number(event.target.value) })}
                      className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs text-[var(--muted)]">Focus</span>
                    <input
                      value={day.focus}
                      onChange={(event) => updateDay(index, { focus: event.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs text-[var(--muted)]">Rest (sec)</span>
                    <input
                      type="number"
                      min={30}
                      max={300}
                      value={day.restSeconds}
                      onChange={(event) => updateDay(index, { restSeconds: Number(event.target.value) })}
                      className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs text-[var(--muted)]">Exercises (comma separated)</span>
                  <textarea
                    rows={2}
                    value={day.exercises}
                    onChange={(event) => updateDay(index, { exercises: event.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                  />
                </label>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={savePlan}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Save size={16} /> Save Plan
            </button>
            <button
              type="button"
              onClick={duplicatePlan}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              <CopyPlus size={16} /> Duplicate Plan
            </button>
          </div>

          {status ? <p className="text-sm text-[var(--muted)]">{status}</p> : null}
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="Reusable Templates" subtitle="Quick-start plan structures">
          <div className="space-y-2">
            {reusableTemplates.map((template, index) => (
              <button
                key={template.name}
                type="button"
                onClick={() => applyTemplate(index)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-3 text-left transition hover:border-[var(--accent)]"
              >
                <p className="font-semibold">{template.name}</p>
                <p className="text-xs text-[var(--muted)]">{template.days.map((day) => day.focus).join(" • ")}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Plan Summary" subtitle="Chart-friendly structure">
          <div className="space-y-2 text-sm">
            <p>Total training days: {days.length}</p>
            <p>Total listed exercises: {totalExercises}</p>
            <p>Primary split: {days.map((day) => day.focus).join(" / ")}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
