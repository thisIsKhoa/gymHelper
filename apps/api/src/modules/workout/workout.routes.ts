import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { createWorkout, history, prs } from './workout.controller.js';

export const workoutRouter = Router();

workoutRouter.use(requireAuth);
workoutRouter.post('/', createWorkout);
workoutRouter.get('/history', history);
workoutRouter.get('/prs', prs);
