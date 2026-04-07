export interface ExerciseSet {
  sets: number
  reps: number
  weightKg?: number
}

export interface PersonalRecord {
  exerciseName: string
  bestWeightKg: number
  bestVolume: number
}

export function calculateSetVolume(input: ExerciseSet): number {
  if (!input.weightKg) {
    return 0
  }

  return Number((input.sets * input.reps * input.weightKg).toFixed(2))
}

export function mergePersonalRecord(
  current: PersonalRecord | undefined,
  exerciseName: string,
  setInput: ExerciseSet,
): PersonalRecord {
  const volume = calculateSetVolume(setInput)
  const nextWeight = setInput.weightKg ?? 0

  if (!current) {
    return {
      exerciseName,
      bestWeightKg: nextWeight,
      bestVolume: volume,
    }
  }

  return {
    exerciseName,
    bestWeightKg: Math.max(current.bestWeightKg, nextWeight),
    bestVolume: Math.max(current.bestVolume, volume),
  }
}
