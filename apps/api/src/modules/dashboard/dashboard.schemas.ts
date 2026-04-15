import { z } from 'zod';

export const dashboardOverviewQuerySchema = z.object({
  weeks: z.coerce.number().int().min(4).max(52).default(16),
});

export type DashboardOverviewQueryInput = z.infer<typeof dashboardOverviewQuerySchema>;
