import { z } from 'zod';

export const workoutEntrySchema = z.object({
  exerciseName: z.string().min(2).max(100),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(100),
  weightKg: z.number().min(0).max(500).optional(),
  rpe: z.number().min(1).max(10).optional(),
  isCompleted: z.boolean().optional().default(true),
  durationSec: z.number().int().min(0).max(7200).optional(),
  restSeconds: z.number().int().min(0).max(900).optional(),
});

export const createWorkoutSchema = z.object({
  idempotencyKey: z.string().uuid().optional(),
  sessionDate: z.coerce.date(),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840).optional(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().optional(),
  notes: z.string().max(500).optional(),
  entries: z.array(workoutEntrySchema).min(1),
});

export const historyQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
});

export const workoutSuggestionQuerySchema = z.object({
  exerciseName: z.string().min(2).max(100),
});

export const workoutCompareQuerySchema = z.object({
  currentSessionId: z.string().min(1),
  previousSessionId: z.string().min(1).optional(),
});

export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;
export type WorkoutHistoryQueryInput = z.infer<typeof historyQuerySchema>;
