import type { NextFunction, Request, Response } from 'express';

import { dashboardOverviewQuerySchema } from './dashboard.schemas.js';
import { getDashboardOverview } from './dashboard.service.js';

export async function overview(req: Request, res: Response, next: NextFunction) {
  try {
    const query = dashboardOverviewQuerySchema.parse(req.query);
    const data = await getDashboardOverview(req.user!.id, query.weeks);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}
