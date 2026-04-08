export interface ExerciseLibraryItem {
  id: string;
  name: string;
  muscleGroup: string;
  exerciseType: 'COMPOUND' | 'ISOLATION';
  defaultRestSeconds: number;
  source: 'system' | 'custom';
}

export interface WorkoutSuggestion {
  exerciseName: string;
  hasPreviousData: boolean;
  suggestedWeightKg: number | null;
  suggestedRestSeconds: number;
  exerciseType: 'COMPOUND' | 'ISOLATION';
  rationale: string;
  lastSessionDate?: string;
  lastWeightKg?: number;
  lastReps?: number;
  lastRpe?: number | null;
  lastEstimated1Rm?: number;
  wasCompleted?: boolean;
}
