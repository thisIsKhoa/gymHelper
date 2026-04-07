import { z } from 'zod';

export const createBodyMetricSchema = z.object({
  loggedAt: z.coerce.date().optional(),
  weightKg: z.number().min(20).max(400),
  bodyFatPct: z.number().min(2).max(70).optional(),
  muscleMassKg: z.number().min(10).max(200).optional(),
  notes: z.string().max(240).optional(),
});

export const bodyMetricHistoryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateBodyMetricInput = z.infer<typeof createBodyMetricSchema>;
