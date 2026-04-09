import { z } from 'zod';

export const consumeNotificationsSchema = z.object({
  limit: z.number().int().min(1).max(20).optional(),
});

export const appActivityPingSchema = z.object({
  at: z.coerce.date().optional(),
});

export type ConsumeNotificationsInput = z.infer<typeof consumeNotificationsSchema>;
export type AppActivityPingInput = z.infer<typeof appActivityPingSchema>;
