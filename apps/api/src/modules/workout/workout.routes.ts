import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { analytics, compare, createWorkout, detail, exportCsv, history, prs, suggestion } from './workout.controller.js';

export const workoutRouter = Router();

workoutRouter.use(requireAuth);
workoutRouter.post('/', createWorkout);
workoutRouter.get('/history', history);
workoutRouter.get('/history/:sessionId', detail);
workoutRouter.get('/compare', compare);
workoutRouter.get('/suggestion', suggestion);
workoutRouter.get('/analytics', analytics);
workoutRouter.get('/export/csv', exportCsv);
workoutRouter.get('/prs', prs);
