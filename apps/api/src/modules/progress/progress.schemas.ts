import { z } from 'zod';

export const exerciseProgressQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(104).default(12),
});
