import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../../utils/http-error.js';
import { exerciseProgressQuerySchema } from './progress.schemas.js';
import { getExerciseProgressByWeek, getProgressOverview } from './progress.service.js';

export async function overview(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getProgressOverview(req.user!.id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

export async function exerciseByWeek(req: Request, res: Response, next: NextFunction) {
  try {
    const rawExerciseName = req.params.exerciseName;
    const exerciseName = Array.isArray(rawExerciseName) ? rawExerciseName[0] : rawExerciseName;
    if (!exerciseName) {
      throw new HttpError(400, 'exerciseName is required');
    }

    const query = exerciseProgressQuerySchema.parse(req.query);
    const data = await getExerciseProgressByWeek(req.user!.id, decodeURIComponent(exerciseName), query.weeks);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}
