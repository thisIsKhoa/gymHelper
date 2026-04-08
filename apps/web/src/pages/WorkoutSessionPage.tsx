import type { WorkoutSessionInput } from "@gymhelper/types";
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock3,
  ClipboardList,
  WifiOff,
  Zap,
} from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { RestTimer } from "../components/workout/RestTimer.tsx";
import { Card } from "../components/ui/Card.tsx";
import { useSuccessToast } from "../components/ui/success-toast.tsx";
import { apiRequest, getAuthToken } from "../lib/api.ts";
import {
  enqueueWorkout,
  getQueuedWorkouts,
  replaceQueuedWorkouts,
  type QueuedWorkout,
} from "../lib/offline-workout-queue.ts";
import { estimateOneRepMax, calculateVolume } from "../lib/workout-utils.ts";
import type {
  ExerciseLibraryItem,
  WorkoutSuggestion,
} from "../types/workout.ts";

interface ExerciseEntryInput {
  id: string;
  exerciseName: string;
  sets: number;
  reps: number;
  weightKg?: number;
  rpe?: number;
  isCompleted: boolean;
  durationSec?: number;
  restSeconds: number;
}

interface SessionHistoryItem {
  id: string;
  sessionDate: string;
  totalVolume: number;
  notes?: string | null;
  entries: Array<{
    exerciseName: string;
    sets: number;
    reps: number;
    volume: number;
    weightKg?: number | null;
    rpe?: number | null;
    isCompleted?: boolean;
    durationSec?: number | null;
    restSeconds?: number | null;
    estimated1Rm?: number;
  }>;
}

interface SessionComparison {
  currentSession: SessionHistoryItem;
  previousSession: SessionHistoryItem | null;
  comparisons: Array<{
    exerciseName: string;
    currentTopWeightKg: number;
    previousTopWeightKg: number;
    deltaTopWeightKg: number;
    currentVolume: number;
    previousVolume: number;
    deltaVolume: number;
  }>;
}

interface SessionPlanExercise {
  exerciseName: string;
  sets: number;
  reps: number;
  targetWeightKg?: number;
  restSeconds?: number;
}

interface SessionPlanTemplate {
  date: string;
  dayOfWeek: number;
  planId: string;
  planName: string;
  focus: string;
  exercises: SessionPlanExercise[];
}

interface PlannedQueueItem extends SessionPlanExercise {
  id: string;
  completed: boolean;
}

const ACTIVE_SESSION_PLAN_ID_KEY = "gymhelper-active-session-plan-id";

function localDateKey(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapHistoryEntryToInput(
  entry: SessionHistoryItem["entries"][number],
): ExerciseEntryInput {
  return {
    id: crypto.randomUUID(),
    exerciseName: entry.exerciseName,
    sets: entry.sets,
    reps: entry.reps,
    weightKg: typeof entry.weightKg === "number" ? entry.weightKg : undefined,
    rpe: typeof entry.rpe === "number" ? entry.rpe : undefined,
    isCompleted: entry.isCompleted ?? true,
    durationSec:
      typeof entry.durationSec === "number" ? entry.durationSec : undefined,
    restSeconds: typeof entry.restSeconds === "number" ? entry.restSeconds : 90,
  };
}

function toWorkoutSessionInput(
  entries: ExerciseEntryInput[],
  notes: string,
  startedAt: Date,
): WorkoutSessionInput {
  return {
    startedAt: startedAt.toISOString(),
    endedAt: new Date().toISOString(),
    notes,
    entries: entries.map((entry) => ({
      exerciseName: entry.exerciseName,
      sets: entry.sets,
      reps: entry.reps,
      weightKg: entry.weightKg,
      rpe: entry.rpe,
      isCompleted: entry.isCompleted,
      durationSec: entry.durationSec,
      restSeconds: entry.restSeconds,
    })),
  };
}

const PLANNED_QUEUE_LIST_STYLE: CSSProperties = {
  contentVisibility: "auto",
  containIntrinsicSize: "420px",
};

const SESSION_ENTRIES_LIST_STYLE: CSSProperties = {
  contentVisibility: "auto",
  containIntrinsicSize: "360px",
};

interface PlannedQueueRowProps {
  item: PlannedQueueItem;
  isActive: boolean;
  onUse: (item: PlannedQueueItem) => void;
  onLog: (item: PlannedQueueItem) => void;
}

const PlannedQueueRow = memo(function PlannedQueueRow({
  item,
  isActive,
  onUse,
  onLog,
}: PlannedQueueRowProps) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between ${
        isActive
          ? "border-[var(--accent)] bg-[color-mix(in oklab,var(--accent) 12%,transparent)]"
          : "border-[var(--border)]"
      }`}
    >
      <div className="min-w-0">
        <p className="break-words text-sm font-medium">{item.exerciseName}</p>
        <p className="text-xs text-[var(--muted)]">
          {typeof item.targetWeightKg === "number"
            ? ` · target ${item.targetWeightKg}kg`
            : ""}
        </p>
      </div>

      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-nowrap sm:items-center">
        {item.completed ? (
          <span className="col-span-2 inline-flex items-center gap-1 text-xs text-emerald-400 sm:col-span-1">
            <CheckCircle2 size={14} /> Done
          </span>
        ) : isActive ? (
          <span className="col-span-2 inline-flex items-center gap-1 text-xs text-[var(--accent)] sm:col-span-1">
            In form
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => onUse(item)}
          className="min-h-10 w-full cursor-pointer rounded-md border border-[var(--border)] px-3 py-1.5 text-xs sm:min-h-0 sm:w-auto"
        >
          {isActive ? "Using" : "Use"}
        </button>

        <button
          type="button"
          onClick={() => onLog(item)}
          disabled={item.completed}
          className="min-h-10 w-full cursor-pointer rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:w-auto"
        >
          Log
        </button>
      </div>
    </div>
  );
});

interface SessionEntryRowProps {
  entry: ExerciseEntryInput;
}

const SessionEntryRow = memo(function SessionEntryRow({
  entry,
}: SessionEntryRowProps) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3 text-sm">
      <p className="font-semibold">{entry.exerciseName}</p>
      <p className="text-[var(--muted)]">
        {entry.sets} x {entry.reps}
        {entry.weightKg ? ` @ ${entry.weightKg}kg` : ""} · RPE{" "}
        {entry.rpe ?? "-"} · Rest {entry.restSeconds}s
      </p>
      <p className="text-xs text-[var(--muted)]">
        Volume {calculateVolume(entry).toFixed(0)} kg · 1RM{" "}
        {estimateOneRepMax(entry.weightKg, entry.reps).toFixed(1)} kg
      </p>
    </div>
  );
});

export function WorkoutSessionPage() {
  const { showSuccessToast } = useSuccessToast();
  const [entries, setEntries] = useState<ExerciseEntryInput[]>([]);
  const [library, setLibrary] = useState<ExerciseLibraryItem[]>([]);
  const [selectedExercise, setSelectedExercise] = useState("Bench Press");
  const [sets, setSets] = useState(1);
  const [reps, setReps] = useState(8);
  const [weightKg, setWeightKg] = useState<number>(0);
  const [rpe, setRpe] = useState<number | "">("");
  const [restSeconds, setRestSeconds] = useState(90);
  const [isCompleted, setIsCompleted] = useState(true);
  const [notes, setNotes] = useState("");
  const [suggestion, setSuggestion] = useState<WorkoutSuggestion | null>(null);
  const [sessionPlan, setSessionPlan] = useState<SessionPlanTemplate | null>(
    null,
  );
  const [plannedQueue, setPlannedQueue] = useState<PlannedQueueItem[]>([]);
  const [activePlannedExerciseId, setActivePlannedExerciseId] = useState<
    string | null
  >(null);
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [comparison, setComparison] = useState<SessionComparison | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null,
  );
  const [queue, setQueue] = useState<QueuedWorkout[]>([]);
  const [timerStartKey, setTimerStartKey] = useState(0);
  const [timerStartSeconds, setTimerStartSeconds] = useState(90);
  const [status, setStatus] = useState<string | null>(null);
  const startedAt = useRef(new Date());
  const logEntryRef = useRef<() => void>(() => undefined);
  const suggestionRequestId = useRef(0);
  const logSetPanelRef = useRef<HTMLDivElement | null>(null);
  const timerPanelRef = useRef<HTMLDivElement | null>(null);

  const scrollIntoViewOnMobile = useCallback(
    (target: HTMLDivElement | null, block: ScrollLogicalPosition = "start") => {
      if (!target || typeof window === "undefined") {
        return;
      }

      if (!window.matchMedia("(max-width: 1023px)").matches) {
        return;
      }

      window.requestAnimationFrame(() => {
        target.scrollIntoView({
          behavior: "smooth",
          block,
        });
      });
    },
    [],
  );

  const scrollToTimerPanel = useCallback(() => {
    scrollIntoViewOnMobile(timerPanelRef.current);
  }, [scrollIntoViewOnMobile]);

  const scrollToLogSetPanel = useCallback(() => {
    scrollIntoViewOnMobile(logSetPanelRef.current);
  }, [scrollIntoViewOnMobile]);

  const applyPlannedExercise = useCallback(
    (item: SessionPlanExercise, plannedExerciseId?: string) => {
      if (plannedExerciseId) {
        setActivePlannedExerciseId(plannedExerciseId);
      }

      setSelectedExercise(item.exerciseName);
      setSets(1);

      if (typeof item.targetWeightKg === "number") {
        setWeightKg(item.targetWeightKg);
      }

      if (typeof item.restSeconds === "number") {
        setRestSeconds(item.restSeconds);
      }

      setStatus(
        `Loaded ${item.exerciseName}. Enter reps and log set (starts at 1).`,
      );
    },
    [],
  );

  const markPlannedExerciseCompleted = useCallback((exerciseName: string) => {
    const normalized = exerciseName.trim().toLowerCase();

    setPlannedQueue((current) => {
      const index = current.findIndex(
        (item) =>
          !item.completed &&
          item.exerciseName.trim().toLowerCase() === normalized,
      );

      if (index === -1) {
        return current;
      }

      const next = [...current];
      const target = next[index];
      if (!target) {
        return current;
      }

      next[index] = {
        ...target,
        completed: true,
      };

      return next;
    });
  }, []);

  const persistLoggedEntry = useCallback(
    async (entry: ExerciseEntryInput) => {
      const payload = toWorkoutSessionInput([entry], notes, startedAt.current);

      try {
        await apiRequest("/workouts", "POST", {
          ...payload,
          sessionDate: localDateKey(),
        });
        setStatus(null);
        showSuccessToast();
        void loadHistory();
      } catch (error) {
        const queued = enqueueWorkout({
          ...payload,
          sessionDate: localDateKey(),
        });
        setQueue(queued);
        const offlineMessage =
          error instanceof Error
            ? `Offline mode: set queued (${error.message})`
            : "Offline mode: set queued for later sync.";
        setStatus(offlineMessage);
      }
    },
    [notes, showSuccessToast],
  );

  const logPlannedExercise = useCallback(
    (item: PlannedQueueItem) => {
      const rest =
        typeof item.restSeconds === "number" && item.restSeconds > 0
          ? item.restSeconds
          : restSeconds;

      applyPlannedExercise(item, item.id);

      const next: ExerciseEntryInput = {
        id: crypto.randomUUID(),
        exerciseName: item.exerciseName.trim(),
        sets,
        reps,
        weightKg:
          typeof item.targetWeightKg === "number" && item.targetWeightKg > 0
            ? item.targetWeightKg
            : undefined,
        rpe: undefined,
        isCompleted: true,
        restSeconds: rest,
      };

      setEntries((current) => [next, ...current]);
      markPlannedExerciseCompleted(next.exerciseName);
      setTimerStartSeconds(rest);
      setTimerStartKey((key) => key + 1);
      scrollToTimerPanel();
      void persistLoggedEntry(next);
    },
    [
      applyPlannedExercise,
      markPlannedExerciseCompleted,
      persistLoggedEntry,
      reps,
      restSeconds,
      sets,
      scrollToTimerPanel,
    ],
  );

  const loadLibrary = async () => {
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

  const loadHistory = async () => {
    try {
      const result = await apiRequest<SessionHistoryItem[]>(
        "/workouts/history?limit=8",
        "GET",
      );
      setHistory(result);

      const todaySession = result.find(
        (session) => session.sessionDate.slice(0, 10) === localDateKey(),
      );

      if (todaySession) {
        setEntries(
          [...todaySession.entries].map(mapHistoryEntryToInput).reverse(),
        );
      } else {
        setEntries([]);
      }

      if (result[0]) {
        setSelectedHistoryId(result[0].id);
        void loadComparison(result[0].id);
      }
    } catch {
      setHistory([]);
    }
  };

  const loadSessionPlan = async () => {
    try {
      const preferredPlanId =
        typeof window === "undefined"
          ? null
          : (window.localStorage.getItem(ACTIVE_SESSION_PLAN_ID_KEY)?.trim() ??
            null);

      const endpoint = preferredPlanId
        ? `/plans/session-template?planId=${encodeURIComponent(preferredPlanId)}`
        : "/plans/session-template";

      const result = await apiRequest<SessionPlanTemplate | null>(
        endpoint,
        "GET",
      );
      setSessionPlan(result);

      if (!result || result.exercises.length === 0) {
        setPlannedQueue([]);
        setActivePlannedExerciseId(null);
        return;
      }

      const queue = result.exercises.map((exercise) => ({
        id: crypto.randomUUID(),
        completed: false,
        ...exercise,
      }));

      setPlannedQueue(queue);

      const first = queue[0];
      if (first) {
        applyPlannedExercise(first, first.id);
      }
    } catch {
      setSessionPlan(null);
      setPlannedQueue([]);
      setActivePlannedExerciseId(null);
    }
  };

  useEffect(() => {
    setQueue(getQueuedWorkouts());
    void loadLibrary();
    void loadSessionPlan();
    void loadHistory();
  }, []);

  useEffect(() => {
    const requestId = suggestionRequestId.current + 1;
    suggestionRequestId.current = requestId;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      async function loadSuggestion() {
        if (!selectedExercise.trim()) {
          return;
        }

        try {
          const result = await apiRequest<WorkoutSuggestion>(
            `/workouts/suggestion?exerciseName=${encodeURIComponent(selectedExercise)}`,
            "GET",
          );

          if (cancelled || suggestionRequestId.current !== requestId) {
            return;
          }

          setSuggestion(result);
          if (result.suggestedWeightKg !== null) {
            setWeightKg(result.suggestedWeightKg);
          }
          setRestSeconds(result.suggestedRestSeconds);
        } catch {
          if (!cancelled && suggestionRequestId.current === requestId) {
            setSuggestion(null);
          }
        }
      }

      void loadSuggestion();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedExercise]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        (target?.getAttribute("contenteditable") ?? "") === "true";

      if (isTyping) {
        return;
      }

      if (event.key.toLowerCase() === "l") {
        event.preventDefault();
        logEntryRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const totalVolume = useMemo(() => {
    return entries.reduce((acc, entry) => acc + calculateVolume(entry), 0);
  }, [entries]);

  const maxEstimatedOneRm = useMemo(() => {
    return entries.reduce((acc, entry) => {
      const estimated = estimateOneRepMax(entry.weightKg, entry.reps);
      return Math.max(acc, estimated);
    }, 0);
  }, [entries]);

  const plannedCompletedCount = useMemo(() => {
    return plannedQueue.filter((item) => item.completed).length;
  }, [plannedQueue]);

  const handleUsePlanned = useCallback(
    (item: PlannedQueueItem) => {
      applyPlannedExercise(item, item.id);
    },
    [applyPlannedExercise],
  );

  const handleLogPlanned = useCallback(
    (item: PlannedQueueItem) => {
      logPlannedExercise(item);
    },
    [logPlannedExercise],
  );

  const logEntry = () => {
    if (!selectedExercise.trim()) {
      setStatus("Choose an exercise before logging.");
      return;
    }

    const next: ExerciseEntryInput = {
      id: crypto.randomUUID(),
      exerciseName: selectedExercise.trim(),
      sets,
      reps,
      weightKg: weightKg > 0 ? weightKg : undefined,
      rpe: rpe === "" ? undefined : rpe,
      isCompleted,
      restSeconds,
    };

    setEntries((current) => [next, ...current]);
    markPlannedExerciseCompleted(next.exerciseName);
    setTimerStartSeconds(restSeconds);
    setTimerStartKey((key) => key + 1);
    scrollToTimerPanel();
    void persistLoggedEntry(next);
  };

  useEffect(() => {
    logEntryRef.current = logEntry;
  });

  const syncQueuedWorkouts = async () => {
    const queued = getQueuedWorkouts();
    if (queued.length === 0) {
      setStatus("No queued workouts.");
      return;
    }

    const failed: QueuedWorkout[] = [];

    for (const item of queued) {
      try {
        await apiRequest("/workouts", "POST", item.payload);
      } catch {
        failed.push(item);
      }
    }

    replaceQueuedWorkouts(failed);
    setQueue(failed);
    if (failed.length === 0) {
      setStatus("All offline workouts synced.");
      showSuccessToast({
        message: "Offline workouts synced successfully",
      });
      await loadHistory();
    } else {
      setStatus(`${failed.length} workout(s) still queued.`);
    }
  };

  const loadComparison = async (sessionId: string) => {
    setSelectedHistoryId(sessionId);
    try {
      const result = await apiRequest<SessionComparison>(
        `/workouts/compare?currentSessionId=${encodeURIComponent(sessionId)}`,
        "GET",
      );
      setComparison(result);
    } catch {
      setComparison(null);
    }
  };

  const exportCsv = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1"}/workouts/export/csv`,
        {
          method: "GET",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `workouts-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      setStatus("CSV export downloaded.");
      showSuccessToast({
        message: "CSV export completed successfully",
      });
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to export CSV.",
      );
    }
  };

  return (
    <div className="grid gap-3 md:gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="min-w-0 space-y-3 md:space-y-4">
        <div ref={logSetPanelRef} className="scroll-mt-24">
          <Card
            title="Start Workout"
            subtitle="Fast one-hand logging with smart overload and auto-save"
            className="perf-contain"
          >
            {sessionPlan ? (
              <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-3">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-start gap-2 text-sm font-semibold">
                      <ClipboardList size={16} className="mt-0.5 shrink-0" />
                      <span className="min-w-0 break-words">
                        {sessionPlan.planName} · {sessionPlan.focus}
                      </span>
                    </p>
                    <p className="mt-1 break-words text-xs text-[var(--muted)]">
                      Auto loaded for this session · {plannedCompletedCount}/
                      {plannedQueue.length} completed
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void loadSessionPlan()}
                    className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-[var(--border)] px-3 py-1 text-xs"
                  >
                    Reload plan
                  </button>
                </div>

                <div
                  className="max-h-64 space-y-2 overflow-y-auto pr-1"
                  style={PLANNED_QUEUE_LIST_STYLE}
                >
                  {plannedQueue.map((item) => {
                    const isActive = activePlannedExerciseId === item.id;

                    return (
                      <PlannedQueueRow
                        key={item.id}
                        item={item}
                        isActive={isActive}
                        onUse={handleUsePlanned}
                        onLog={handleLogPlanned}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm text-[var(--muted)]">
                Chua co plan cho hom nay. Ban van co the log buoi tap thu cong.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  Exercise
                </span>
                <select
                  value={selectedExercise}
                  onChange={(event) => setSelectedExercise(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
                >
                  {library.map((exercise) => (
                    <option key={exercise.id} value={exercise.name}>
                      {exercise.name} ({exercise.muscleGroup})
                    </option>
                  ))}
                  {!library.some(
                    (exercise) => exercise.name === selectedExercise,
                  ) ? (
                    <option value={selectedExercise}>{selectedExercise}</option>
                  ) : null}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  Sets
                </span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={sets}
                  onChange={(event) => setSets(Number(event.target.value))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  Reps
                </span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={reps}
                  onChange={(event) => setReps(Number(event.target.value))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  Weight (kg)
                </span>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={weightKg}
                  onChange={(event) => setWeightKg(Number(event.target.value))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  RPE (optional)
                </span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={0.5}
                  value={rpe}
                  onChange={(event) => {
                    const next = event.target.value;
                    setRpe(next ? Number(next) : "");
                  }}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  Rest (sec)
                </span>
                <input
                  type="number"
                  min={45}
                  max={300}
                  value={restSeconds}
                  onChange={(event) =>
                    setRestSeconds(Number(event.target.value))
                  }
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
                />
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={isCompleted}
                  onChange={(event) => setIsCompleted(event.target.checked)}
                />
                Set block completed with good form
              </label>
            </div>

            {suggestion ? (
              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-3 text-sm">
                <div className="flex items-center gap-2 text-[var(--accent)]">
                  <Zap size={16} />
                  Smart suggestion
                </div>
                <p className="mt-2 text-[var(--muted)]">
                  {suggestion.rationale}
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
                  <p>Type: {suggestion.exerciseType}</p>
                  <p>Rest: {suggestion.suggestedRestSeconds}s</p>
                  <p>
                    Suggested next load: {suggestion.suggestedWeightKg ?? "-"}
                    {suggestion.suggestedWeightKg !== null ? " kg" : ""}
                  </p>
                  <p>Last 1RM: {suggestion.lastEstimated1Rm ?? "-"}</p>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Smart rest policy: Bench 120-180s, Isolation 60s.
                </p>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <button
                type="button"
                onClick={logEntry}
                className="min-h-11 w-full rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition-colors"
              >
                Log Set (L)
              </button>
              <button
                type="button"
                onClick={() => void syncQueuedWorkouts()}
                className="min-h-11 w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold"
              >
                <WifiOff size={16} className="mr-1 inline-block" /> Sync Offline
                ({queue.length})
              </button>
              <button
                type="button"
                onClick={() => void exportCsv()}
                className="min-h-11 w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold"
              >
                <ArrowDownToLine size={16} className="mr-1 inline-block" />{" "}
                Export CSV
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-4">
              <div className="mb-3 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold">Current Session Entries</p>
                <p className="text-xs text-[var(--muted)]">
                  Total volume: {totalVolume.toFixed(0)} kg · Max est. 1RM:{" "}
                  {maxEstimatedOneRm.toFixed(1)} kg
                </p>
              </div>
              <div
                className="max-h-72 space-y-2 overflow-y-auto pr-1"
                style={SESSION_ENTRIES_LIST_STYLE}
              >
                {entries.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    No exercises logged yet.
                  </p>
                ) : (
                  entries.map((entry) => (
                    <SessionEntryRow key={entry.id} entry={entry} />
                  ))
                )}
              </div>
            </div>

            <label className="mt-4 block">
              <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Session notes
              </span>
              <textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
                placeholder="Energy level, cues, or next-session notes..."
              />
            </label>

            {status ? (
              <p className="mt-3 text-sm text-[var(--muted)]">{status}</p>
            ) : null}
          </Card>
        </div>
      </div>

      <div className="min-w-0 space-y-3 md:space-y-4">
        <div ref={timerPanelRef} className="scroll-mt-24">
          <Card
            title="Rest Timer"
            subtitle="Auto-starts after each logged set block"
          >
            <RestTimer
              defaultSeconds={90}
              autoStartSeconds={timerStartSeconds}
              autoStartKey={timerStartKey}
              onComplete={scrollToLogSetPanel}
            />
          </Card>
        </div>

        <Card
          title="Workout History Compare"
          subtitle="Compare today vs previous session"
          className="perf-contain"
        >
          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No session history yet.
              </p>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Session
                  </span>
                  <select
                    value={selectedHistoryId ?? ""}
                    onChange={(event) =>
                      void loadComparison(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm"
                  >
                    {history.map((item) => (
                      <option key={item.id} value={item.id}>
                        {new Date(item.sessionDate).toLocaleDateString()} ·{" "}
                        {item.totalVolume.toFixed(0)} kg
                      </option>
                    ))}
                  </select>
                </label>

                {comparison?.comparisons?.slice(0, 6).map((row) => (
                  <article
                    key={row.exerciseName}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-3 text-sm"
                  >
                    <p className="font-semibold">{row.exerciseName}</p>
                    <p className="text-[var(--muted)]">
                      Top weight: {row.currentTopWeightKg}kg (
                      {row.deltaTopWeightKg >= 0 ? "+" : ""}
                      {row.deltaTopWeightKg}kg)
                    </p>
                    <p className="text-[var(--muted)]">
                      Volume: {row.currentVolume.toFixed(0)} (
                      {row.deltaVolume >= 0 ? "+" : ""}
                      {row.deltaVolume.toFixed(0)})
                    </p>
                  </article>
                ))}
                {!comparison ? (
                  <p className="text-sm text-[var(--muted)]">
                    Select a session to load comparison.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </Card>

        <Card title="Logging Shortcuts" subtitle="Speed mode">
          <div className="space-y-2 text-sm text-[var(--muted)]">
            <p>Press L to log current set block and auto-save.</p>
            <p>
              One day uses one session. New logs are appended automatically.
            </p>
            <p className="inline-flex items-center gap-1">
              <Clock3 size={14} /> Timer auto-starts after each logged set.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
