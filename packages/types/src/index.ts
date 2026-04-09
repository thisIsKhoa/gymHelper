export type UserLevel = 'beginner' | 'intermediate' | 'advanced';
export type UserGoal = 'muscle_gain' | 'fat_loss' | 'strength';

export interface ExerciseInput {
  exerciseName: string;
  sets: number;
  reps: number;
  weightKg?: number;
  rpe?: number;
  isCompleted?: boolean;
  durationSec?: number;
  restSeconds?: number;
}

export interface WorkoutSessionInput {
  startedAt: string;
  endedAt?: string;
  timezoneOffsetMinutes?: number;
  notes?: string;
  entries: ExerciseInput[];
}

export interface BodyMetricInput {
  loggedAt?: string;
  weightKg: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  notes?: string;
}

export interface WeeklyExercisePoint {
  week: string;
  avgWeightKg: number;
  maxWeightKg: number;
  totalVolume: number;
  maxEstimated1Rm: number;
}

export interface PersonalRecordSummary {
  exerciseName: string;
  bestWeightKg: number;
  bestVolume: number;
  achievedAt: string;
}

export interface PlanRecommendationRequest {
  level: UserLevel;
  goal: UserGoal;
  daysPerWeek: number;
}

export interface RestRecommendation {
  exerciseName: string;
  recommendedRestSeconds: number;
  rationale: string;
}
