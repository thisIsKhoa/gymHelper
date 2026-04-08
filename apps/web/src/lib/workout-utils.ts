export interface WorkoutMathInput {
  sets: number;
  reps: number;
  weightKg?: number;
}

export function calculateVolume(input: WorkoutMathInput): number {
  if (!input.weightKg) {
    return 0;
  }

  return Number((input.sets * input.reps * input.weightKg).toFixed(2));
}

export function estimateOneRepMax(weightKg?: number, reps?: number): number {
  if (!weightKg || !reps) {
    return 0;
  }

  // Epley formula: 1RM = weight * (1 + reps / 30)
  return Number((weightKg * (1 + reps / 30)).toFixed(2));
}

export function formatKg(value: number): string {
  return `${Number(value.toFixed(2))} kg`;
}
