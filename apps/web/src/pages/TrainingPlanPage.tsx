import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  GripVertical,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Card } from "../components/ui/Card.tsx";
import { apiRequest } from "../lib/api.ts";
import type { ExerciseLibraryItem } from "../types/workout.ts";

interface PlanDay {
  dayOfWeek: number;
  focus: string;
  exercises: string[];
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
    exercises: ["Bench Press", "Overhead Press", "Incline DB Press"],
    restSeconds: 120,
  },
  {
    dayOfWeek: 3,
    focus: "Pull",
    exercises: ["Barbell Row", "Pull Up", "Face Pull"],
    restSeconds: 90,
  },
  {
    dayOfWeek: 5,
    focus: "Legs",
    exercises: ["Back Squat", "Romanian Deadlift", "Leg Press"],
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
        exercises: ["Bench Press", "Row", "Shoulder Press"],
        restSeconds: 120,
      },
      {
        dayOfWeek: 3,
        focus: "Lower",
        exercises: ["Back Squat", "Deadlift", "Lunges"],
        restSeconds: 150,
      },
      {
        dayOfWeek: 5,
        focus: "Upper",
        exercises: ["Incline Bench", "Pulldown", "Lateral Raise"],
        restSeconds: 90,
      },
      {
        dayOfWeek: 6,
        focus: "Lower",
        exercises: ["Front Squat", "Hip Thrust", "Ham Curl"],
        restSeconds: 120,
      },
    ],
  },
  {
    name: "LCH5 - 6 Day Split",
    days: [
      {
        dayOfWeek: 1,
        focus: "Push A",
        exercises: ["Bench Press", "Incline DB Press", "Overhead Press"],
        restSeconds: 120,
      },
      {
        dayOfWeek: 2,
        focus: "Pull A",
        exercises: ["Barbell Row", "Pull Up", "Face Pull"],
        restSeconds: 105,
      },
      {
        dayOfWeek: 3,
        focus: "Legs A",
        exercises: ["Back Squat", "Romanian Deadlift", "Leg Press"],
        restSeconds: 150,
      },
      {
        dayOfWeek: 4,
        focus: "Push B",
        exercises: ["Dumbbell Bench Press", "Lateral Raise", "Tricep Pushdown"],
        restSeconds: 90,
      },
      {
        dayOfWeek: 5,
        focus: "Pull B",
        exercises: ["Lat Pulldown", "Seated Cable Row", "Bicep Curl"],
        restSeconds: 90,
      },
      {
        dayOfWeek: 6,
        focus: "Legs B",
        exercises: ["Front Squat", "Hip Thrust", "Leg Curl"],
        restSeconds: 135,
      },
    ],
  },
];

const ACTIVE_SESSION_PLAN_ID_KEY = "gymhelper-active-session-plan-id";
const ALL_MUSCLE_GROUPS = "ALL";

function setActiveSessionPlanId(planId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!planId) {
    window.localStorage.removeItem(ACTIVE_SESSION_PLAN_ID_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_SESSION_PLAN_ID_KEY, planId);
}

function parseExerciseList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (typeof item !== "object" || item === null) {
        return "";
      }

      const value = (item as { exerciseName?: unknown; name?: unknown })
        .exerciseName;
      if (typeof value === "string") {
        return value.trim();
      }

      const fallbackName = (item as { exerciseName?: unknown; name?: unknown })
        .name;
      return typeof fallbackName === "string" ? fallbackName.trim() : "";
    })
    .filter(Boolean);
}

export function TrainingPlanPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [library, setLibrary] = useState<ExerciseLibraryItem[]>([]);
  const [planName, setPlanName] = useState("Personal Plan");
  const [days, setDays] = useState<PlanDay[]>(defaultDays);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [selectedExerciseByDay, setSelectedExerciseByDay] = useState<
    Record<number, string>
  >({});
  const [selectedMuscleGroupByDay, setSelectedMuscleGroupByDay] = useState<
    Record<number, string>
  >({});
  const [dragState, setDragState] = useState<{
    dayIndex: number;
    exerciseIndex: number;
  } | null>(null);

  const totalExercises = useMemo(() => {
    return days.reduce((acc, day) => acc + day.exercises.length, 0);
  }, [days]);

  const muscleGroupOptions = useMemo(() => {
    return Array.from(new Set(library.map((exercise) => exercise.muscleGroup)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [library]);

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
        setActiveSessionPlanId(first.id);
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
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load plans",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadExerciseLibrary = async () => {
    try {
      const result = await apiRequest<ExerciseLibraryItem[]>(
        "/exercises",
        "GET",
      );
      setLibrary(result);
    } catch {
      setLibrary([]);
    }
  };

  useEffect(() => {
    void loadPlans();
    void loadExerciseLibrary();
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
      exercises: day.exercises.map((exerciseName) => ({
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
        setActiveSessionPlanId(currentPlanId);
        setStatus("Plan updated.");
      } else {
        const created = await apiRequest<{ id: string }>(
          "/plans",
          "POST",
          buildPayload(),
        );
        setCurrentPlanId(created.id);
        setActiveSessionPlanId(created.id);
        setStatus("Plan created.");
      }

      await loadPlans();
    } catch (saveError) {
      setStatus(
        saveError instanceof Error ? saveError.message : "Failed to save plan",
      );
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
      setActiveSessionPlanId(duplicated.id);
      setStatus("Plan duplicated.");
      await loadPlans();
    } catch (duplicateError) {
      setStatus(
        duplicateError instanceof Error
          ? duplicateError.message
          : "Failed to duplicate plan",
      );
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
    setActiveSessionPlanId(selected.id);
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
    setActiveSessionPlanId(null);
    setPlanName(template.name);
    setDays(
      template.days.map((day) => ({ ...day, exercises: [...day.exercises] })),
    );
    setStatus(`Template applied: ${template.name}`);
  };

  const startSessionWithSelectedPlan = () => {
    if (!currentPlanId) {
      setStatus("Save or select a plan first, then open session.");
      return;
    }

    setActiveSessionPlanId(currentPlanId);
    navigate("/session");
  };

  const getFilteredLibraryByDay = (dayIndex: number) => {
    const selectedMuscleGroup =
      selectedMuscleGroupByDay[dayIndex] ?? ALL_MUSCLE_GROUPS;

    if (selectedMuscleGroup === ALL_MUSCLE_GROUPS) {
      return library;
    }

    return library.filter(
      (exercise) => exercise.muscleGroup === selectedMuscleGroup,
    );
  };

  const addExercise = (dayIndex: number) => {
    const filteredLibrary = getFilteredLibraryByDay(dayIndex);
    const raw = (
      selectedExerciseByDay[dayIndex] ??
      filteredLibrary[0]?.name ??
      ""
    ).trim();
    if (!raw) {
      setStatus("Select an exercise from library first.");
      return;
    }

    const duplicated = days[dayIndex]?.exercises.some(
      (exercise) => exercise.toLowerCase() === raw.toLowerCase(),
    );

    if (duplicated) {
      setStatus("Exercise already exists in this day.");
      return;
    }

    setDays((current) =>
      current.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              exercises: [...day.exercises, raw],
            }
          : day,
      ),
    );
  };

  const removeExercise = (dayIndex: number, exerciseIndex: number) => {
    setDays((current) =>
      current.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              exercises: day.exercises.filter(
                (_, idx) => idx !== exerciseIndex,
              ),
            }
          : day,
      ),
    );
  };

  const moveExercise = (
    dayIndex: number,
    fromIndex: number,
    toIndex: number,
  ) => {
    setDays((current) =>
      current.map((day, index) => {
        if (index !== dayIndex || fromIndex === toIndex) {
          return day;
        }

        const next = [...day.exercises];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved as string);
        return { ...day, exercises: next };
      }),
    );
  };

  if (isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading plans...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card
        title="Custom Training Schedule"
        subtitle="Create, edit, and reuse weekly plans"
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Existing Plans
            </span>
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
            <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Plan Name
            </span>
            <input
              value={planName}
              onChange={(event) => setPlanName(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
            />
          </label>

          <div className="grid gap-3">
            {days.map((day, index) => {
              const selectedMuscleGroup =
                selectedMuscleGroupByDay[index] ?? ALL_MUSCLE_GROUPS;
              const filteredLibrary = getFilteredLibraryByDay(index);

              return (
                <article
                  key={`${day.dayOfWeek}-${index}`}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-3"
                >
                  <div className="mb-2 grid gap-2 md:grid-cols-3">
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">
                        Day of Week
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={7}
                        value={day.dayOfWeek}
                        onChange={(event) =>
                          updateDay(index, {
                            dayOfWeek: Number(event.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">
                        Focus
                      </span>
                      <input
                        value={day.focus}
                        onChange={(event) =>
                          updateDay(index, { focus: event.target.value })
                        }
                        className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-[var(--muted)]">
                        Rest (sec)
                      </span>
                      <input
                        type="number"
                        min={30}
                        max={300}
                        value={day.restSeconds}
                        onChange={(event) =>
                          updateDay(index, {
                            restSeconds: Number(event.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-xs text-[var(--muted)]">
                      Exercises (drag to reorder)
                    </span>

                    <div className="space-y-2 rounded-lg border border-[var(--border)] p-2">
                      {day.exercises.map((exercise, exerciseIndex) => (
                        <div
                          key={`${exercise}-${exerciseIndex}`}
                          draggable
                          onDragStart={() =>
                            setDragState({ dayIndex: index, exerciseIndex })
                          }
                          onDragEnd={() => setDragState(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            if (!dragState || dragState.dayIndex !== index) {
                              return;
                            }
                            moveExercise(
                              index,
                              dragState.exerciseIndex,
                              exerciseIndex,
                            );
                            setDragState(null);
                          }}
                          className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="inline-flex min-w-0 items-center gap-2 text-sm">
                            <GripVertical
                              size={14}
                              className="shrink-0 text-[var(--muted)]"
                            />
                            <span className="break-words">{exercise}</span>
                          </span>
                          <div className="flex items-center gap-1 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() =>
                                moveExercise(
                                  index,
                                  exerciseIndex,
                                  exerciseIndex - 1,
                                )
                              }
                              disabled={exerciseIndex === 0}
                              className="rounded-md border border-[var(--border)] p-1.5 text-[var(--muted)] disabled:opacity-40"
                              aria-label="Move exercise up"
                            >
                              <ArrowUp size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                moveExercise(
                                  index,
                                  exerciseIndex,
                                  exerciseIndex + 1,
                                )
                              }
                              disabled={
                                exerciseIndex === day.exercises.length - 1
                              }
                              className="rounded-md border border-[var(--border)] p-1.5 text-[var(--muted)] disabled:opacity-40"
                              aria-label="Move exercise down"
                            >
                              <ArrowDown size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                removeExercise(index, exerciseIndex)
                              }
                              className="rounded-md border border-[var(--border)] p-1.5 text-[var(--muted)]"
                              aria-label="Remove exercise"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {day.exercises.length === 0 ? (
                        <p className="text-xs text-[var(--muted)]">
                          No exercises yet.
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[0.8fr_1.4fr_auto]">
                      <select
                        value={selectedMuscleGroup}
                        onChange={(event) => {
                          const nextMuscleGroup = event.target.value;

                          setSelectedMuscleGroupByDay((current) => ({
                            ...current,
                            [index]: nextMuscleGroup,
                          }));

                          setSelectedExerciseByDay((current) => {
                            const currentExercise = current[index] ?? "";
                            if (!currentExercise) {
                              return current;
                            }

                            const nextOptions =
                              nextMuscleGroup === ALL_MUSCLE_GROUPS
                                ? library
                                : library.filter(
                                    (exercise) =>
                                      exercise.muscleGroup === nextMuscleGroup,
                                  );

                            const stillExists = nextOptions.some(
                              (exercise) => exercise.name === currentExercise,
                            );

                            if (stillExists) {
                              return current;
                            }

                            return {
                              ...current,
                              [index]: nextOptions[0]?.name ?? "",
                            };
                          });
                        }}
                        className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                      >
                        <option value={ALL_MUSCLE_GROUPS}>
                          All muscle groups
                        </option>
                        {muscleGroupOptions.map((muscleGroup) => (
                          <option key={muscleGroup} value={muscleGroup}>
                            {muscleGroup.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>

                      <select
                        value={selectedExerciseByDay[index] ?? ""}
                        onChange={(event) =>
                          setSelectedExerciseByDay((current) => ({
                            ...current,
                            [index]: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                      >
                        <option value="">Select from library</option>
                        {filteredLibrary.map((exercise) => (
                          <option key={exercise.id} value={exercise.name}>
                            {exercise.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => addExercise(index)}
                        disabled={library.length === 0}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                    {library.length === 0 ? (
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        Exercise library is empty. Add custom exercises in
                        Library page.
                      </p>
                    ) : filteredLibrary.length === 0 ? (
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        No exercises in this muscle group.
                      </p>
                    ) : null}
                  </label>
                </article>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={savePlan}
              disabled={isSaving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
            >
              <Save size={16} /> Save Plan
            </button>
            <button
              type="button"
              onClick={duplicatePlan}
              disabled={isSaving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60 sm:w-auto"
            >
              <CopyPlus size={16} /> Duplicate Plan
            </button>
            <button
              type="button"
              onClick={startSessionWithSelectedPlan}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold sm:w-auto"
            >
              Use In Session
            </button>
          </div>

          {status ? (
            <p className="text-sm text-[var(--muted)]">{status}</p>
          ) : null}
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
                <p className="text-xs text-[var(--muted)]">
                  {template.days.map((day) => day.focus).join(" • ")}
                </p>
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
