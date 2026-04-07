import { UserGoal, UserLevel } from '@prisma/client';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(2).max(80),
  level: z.nativeEnum(UserLevel).optional(),
  goal: z.nativeEnum(UserGoal).optional(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
