import { ExerciseType, MuscleGroup } from '@prisma/client';
import { z } from 'zod';

export const exerciseLibraryQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
});

export const createCustomExerciseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  muscleGroup: z.nativeEnum(MuscleGroup),
  exerciseType: z.nativeEnum(ExerciseType),
  defaultRestSeconds: z.number().int().min(45).max(300).optional(),
});

export type CreateCustomExerciseInput = z.infer<typeof createCustomExerciseSchema>;
