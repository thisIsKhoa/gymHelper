import type { WorkoutSessionInput } from '@gymhelper/types';

const STORAGE_KEY = 'gymhelper-offline-workouts';

export interface QueuedWorkout {
  id: string;
  createdAt: string;
  payload: WorkoutSessionInput & { sessionDate: string };
}

function safeParse(value: string | null): QueuedWorkout[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as QueuedWorkout[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getQueuedWorkouts(): QueuedWorkout[] {
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function enqueueWorkout(payload: WorkoutSessionInput & { sessionDate: string }) {
  const current = getQueuedWorkouts();
  const next: QueuedWorkout = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    payload,
  };

  const updated = [next, ...current];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function replaceQueuedWorkouts(workouts: QueuedWorkout[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
}

export function clearQueuedWorkouts() {
  window.localStorage.removeItem(STORAGE_KEY);
}
