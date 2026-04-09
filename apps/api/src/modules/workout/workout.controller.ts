import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../../utils/http-error.js';
import {
  createWorkoutSchema,
  historyQuerySchema,
  workoutCompareQuerySchema,
  workoutSuggestionQuerySchema,
} from './workout.schemas.js';
import {
  compareWorkoutSessions,
  createWorkoutSession,
  exportWorkoutHistoryCsv,
  getPersonalRecords,
  getWorkoutAnalytics,
  getWorkoutHistory,
  getWorkoutSessionDetail,
  getWorkoutSuggestion,
} from './workout.service.js';

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
    const workouts = await getWorkoutHistory(req.user!.id, query);
    res.status(200).json(workouts);
  } catch (error) {
    next(error);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    const rawSessionId = req.params.sessionId;
    const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
    if (!sessionId) {
      throw new HttpError(400, 'sessionId is required');
    }

    const workout = await getWorkoutSessionDetail(req.user!.id, sessionId);
    res.status(200).json(workout);
  } catch (error) {
    next(error);
  }
}

export async function compare(req: Request, res: Response, next: NextFunction) {
  try {
    const query = workoutCompareQuerySchema.parse(req.query);
    const result = await compareWorkoutSessions(req.user!.id, query.currentSessionId, query.previousSessionId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function suggestion(req: Request, res: Response, next: NextFunction) {
  try {
    const query = workoutSuggestionQuerySchema.parse(req.query);
    const result = await getWorkoutSuggestion(req.user!.id, query.exerciseName);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function analytics(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getWorkoutAnalytics(req.user!.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function exportCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const csv = await exportWorkoutHistoryCsv(req.user!.id);
    const dateTag = new Date().toISOString().slice(0, 10);

    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="workouts-${dateTag}.csv"`)
      .send(csv);
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
