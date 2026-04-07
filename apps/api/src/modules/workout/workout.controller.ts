import type { NextFunction, Request, Response } from 'express';

import { createWorkoutSchema, historyQuerySchema } from './workout.schemas.js';
import { createWorkoutSession, getPersonalRecords, getWorkoutHistory } from './workout.service.js';

export async function createWorkout(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createWorkoutSchema.parse(req.body);
    const workout = await createWorkoutSession(req.user!.id, input);
    res.status(201).json(workout);
  } catch (error) {
    next(error);
  }
}

export async function history(req: Request, res: Response, next: NextFunction) {
  try {
    const query = historyQuerySchema.parse(req.query);
    const workouts = await getWorkoutHistory(req.user!.id, query.from, query.to);
    res.status(200).json(workouts);
  } catch (error) {
    next(error);
  }
}

export async function prs(req: Request, res: Response, next: NextFunction) {
  try {
    const records = await getPersonalRecords(req.user!.id);
    res.status(200).json(records);
  } catch (error) {
    next(error);
  }
}
