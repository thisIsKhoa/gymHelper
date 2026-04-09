export interface WorkoutGamificationEntryInput {
  exerciseName: string;
  sets: number;
  reps: number;
  weightKg?: number;
  rpe?: number;
  restSeconds?: number;
}

export interface WorkoutGamificationPayload {
  sessionId: string;
  sessionDate: Date;
  entries: WorkoutGamificationEntryInput[];
}

export interface GamificationJobPayload extends WorkoutGamificationPayload {
  userId: string;
  jobKey: string;
}
