import type { NextFunction, Request, Response } from 'express';

import { bodyMetricHistoryQuerySchema, createBodyMetricSchema } from './body-metrics.schemas.js';
import { createBodyMetric, getBodyMetricHistory, getLatestBodyMetric } from './body-metrics.service.js';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createBodyMetricSchema.parse(req.body);
    const result = await createBodyMetric(req.user!.id, input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function history(req: Request, res: Response, next: NextFunction) {
  try {
    const query = bodyMetricHistoryQuerySchema.parse(req.query);
    const result = await getBodyMetricHistory(req.user!.id, query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function latest(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getLatestBodyMetric(req.user!.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
