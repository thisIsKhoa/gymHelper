import type { NextFunction, Request, Response } from 'express';

import { getDashboardOverview } from './dashboard.service.js';

export async function overview(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getDashboardOverview(req.user!.id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}
