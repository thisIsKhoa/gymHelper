import type { WorkoutSessionInput } from "@gymhelper/types";
import { Save } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import {
  ExerciseLogger,
  type ExerciseEntryInput,
} from "../components/workout/ExerciseLogger.tsx";
import { RestTimer } from "../components/workout/RestTimer.tsx";
import { Card } from "../components/ui/Card.tsx";
import { apiRequest } from "../lib/api.ts";
import {
  calculateSetVolume,
  mergePersonalRecord,
  type PersonalRecord,
} from "../lib/pr.ts";

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
      durationSec: entry.durationSec,
      restSeconds: entry.restSeconds,
    })),
  };
}

export function WorkoutSessionPage() {
  const [entries, setEntries] = useState<ExerciseEntryInput[]>([]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const startedAt = useRef(new Date());

  const totalVolume = useMemo(() => {
    return entries.reduce((acc, entry) => acc + calculateSetVolume(entry), 0);
  }, [entries]);

  const livePrs = useMemo(() => {
    const map = new Map<string, PersonalRecord>();

    for (const entry of entries) {
      map.set(
        entry.exerciseName,
        mergePersonalRecord(
          map.get(entry.exerciseName),
          entry.exerciseName,
          entry,
        ),
      );
    }

    return Array.from(map.values());
  }, [entries]);

  const saveWorkout = async () => {
    if (entries.length === 0) {
      setStatus("Add at least one exercise before saving.");
      return;
    }

    const payload = toWorkoutSessionInput(entries, notes, startedAt.current);

    try {
      await apiRequest("/workouts", "POST", {
        ...payload,
        sessionDate: new Date().toISOString(),
      });
      setStatus("Workout saved to API successfully.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `Save failed: ${error.message}`
          : "Save failed: API unavailable.",
      );
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-4">
        <Card
          title="Live Workout Tracker"
          subtitle="Log sets, reps, load, duration, and rest targets in real time"
        >
          <ExerciseLogger
            onAdd={(entry) => setEntries((current) => [entry, ...current])}
          />

          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Current Session Entries</p>
              <p className="text-xs text-[var(--muted)]">
                Total volume: {totalVolume.toFixed(0)} kg
              </p>
            </div>
            <div className="space-y-2">
              {entries.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  No exercises logged yet.
                </p>
              ) : (
                entries.map((entry, index) => (
                  <div
                    key={`${entry.exerciseName}-${index}`}
                    className="rounded-lg border border-[var(--border)] p-3 text-sm"
                  >
                    <p className="font-semibold">{entry.exerciseName}</p>
                    <p className="text-[var(--muted)]">
                      {entry.sets} sets x {entry.reps} reps
                      {entry.weightKg ? ` @ ${entry.weightKg}kg` : ""}
                    </p>
                  </div>
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

          <button
            type="button"
            onClick={saveWorkout}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            <Save size={16} /> Save Workout
          </button>

          {status ? (
            <p className="mt-3 text-sm text-[var(--muted)]">{status}</p>
          ) : null}
        </Card>
      </div>

      <div className="space-y-4">
        <Card
          title="Rest Timer"
          subtitle="Countdown between sets with optional real-time sync"
        >
          <RestTimer defaultSeconds={90} />
        </Card>

        <Card
          title="Live PR Preview"
          subtitle="Estimated personal records from this session"
        >
          <div className="space-y-2">
            {livePrs.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                PR preview appears as you log entries.
              </p>
            ) : (
              livePrs.map((pr) => (
                <div
                  key={pr.exerciseName}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-3"
                >
                  <p className="font-semibold">{pr.exerciseName}</p>
                  <p className="text-sm text-[var(--muted)]">
                    Best weight: {pr.bestWeightKg} kg
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    Best volume: {pr.bestVolume.toFixed(0)} kg
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
