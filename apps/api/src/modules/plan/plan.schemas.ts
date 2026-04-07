import { UserGoal, UserLevel } from '@prisma/client';
import { z } from 'zod';

const planExerciseSchema = z.object({
  exerciseName: z.string().min(2),
  sets: z.number().int().min(1).max(10),
  reps: z.number().int().min(1).max(30),
  targetWeightKg: z.number().min(0).max(500).optional(),
});

const planDaySchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  focus: z.string().min(2).max(100),
  exercises: z.array(planExerciseSchema).min(1),
});

export const createPlanSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(240).optional(),
  goal: z.nativeEnum(UserGoal).optional(),
  level: z.nativeEnum(UserLevel).optional(),
  days: z.array(planDaySchema).min(1).max(7),
});

export const updatePlanSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(240).optional(),
  days: z.array(planDaySchema).min(1).max(7),
});

export const duplicatePlanSchema = z.object({
  name: z.string().min(3).max(120).optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type DuplicatePlanInput = z.infer<typeof duplicatePlanSchema>;
