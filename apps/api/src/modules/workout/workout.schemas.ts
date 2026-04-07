import { z } from 'zod';

export const workoutEntrySchema = z.object({
  exerciseName: z.string().min(2).max(100),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(100),
  weightKg: z.number().min(0).max(500).optional(),
  durationSec: z.number().int().min(0).max(7200).optional(),
  restSeconds: z.number().int().min(0).max(900).optional(),
});

export const createWorkoutSchema = z.object({
  sessionDate: z.coerce.date(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().optional(),
  notes: z.string().max(500).optional(),
  entries: z.array(workoutEntrySchema).min(1),
});

export const historyQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;
