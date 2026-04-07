import { useState } from "react";

export interface ExerciseEntryInput {
  exerciseName: string;
  sets: number;
  reps: number;
  weightKg?: number;
  durationSec?: number;
  restSeconds?: number;
}

interface ExerciseLoggerProps {
  onAdd: (entry: ExerciseEntryInput) => void;
}

export function ExerciseLogger({ onAdd }: ExerciseLoggerProps) {
  const [exerciseName, setExerciseName] = useState("");
  const [sets, setSets] = useState(4);
  const [reps, setReps] = useState(8);
  const [weightKg, setWeightKg] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [restSeconds, setRestSeconds] = useState(90);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!exerciseName.trim()) {
      return;
    }

    onAdd({
      exerciseName: exerciseName.trim(),
      sets,
      reps,
      weightKg: weightKg > 0 ? weightKg : undefined,
      durationSec: durationSec > 0 ? durationSec : undefined,
      restSeconds,
    });

    setExerciseName("");
    setSets(4);
    setReps(8);
    setWeightKg(0);
    setDurationSec(0);
  };

  return (
    <form className="grid gap-3 md:grid-cols-3" onSubmit={submit}>
      <label className="md:col-span-3">
        <span className="mb-1 block text-xs uppercase tracking-wider text-[var(--muted)]">
          Exercise
        </span>
        <input
          value={exerciseName}
          onChange={(event) => setExerciseName(event.target.value)}
          placeholder="e.g. Back Squat"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>

      <label>
        <span className="mb-1 block text-xs uppercase tracking-wider text-[var(--muted)]">
          Sets
        </span>
        <input
          type="number"
          min={1}
          value={sets}
          onChange={(event) => setSets(Number(event.target.value))}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>

      <label>
        <span className="mb-1 block text-xs uppercase tracking-wider text-[var(--muted)]">
          Reps
        </span>
        <input
          type="number"
          min={1}
          value={reps}
          onChange={(event) => setReps(Number(event.target.value))}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>

      <label>
        <span className="mb-1 block text-xs uppercase tracking-wider text-[var(--muted)]">
          Weight (kg)
        </span>
        <input
          type="number"
          min={0}
          value={weightKg}
          onChange={(event) => setWeightKg(Number(event.target.value))}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>

      <label>
        <span className="mb-1 block text-xs uppercase tracking-wider text-[var(--muted)]">
          Duration (sec)
        </span>
        <input
          type="number"
          min={0}
          value={durationSec}
          onChange={(event) => setDurationSec(Number(event.target.value))}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>

      <label>
        <span className="mb-1 block text-xs uppercase tracking-wider text-[var(--muted)]">
          Rest (sec)
        </span>
        <input
          type="number"
          min={0}
          value={restSeconds}
          onChange={(event) => setRestSeconds(Number(event.target.value))}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>

      <div className="flex items-end">
        <button
          type="submit"
          className="w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Add Exercise
        </button>
      </div>
    </form>
  );
}
