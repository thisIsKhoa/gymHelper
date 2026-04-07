import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { exerciseByWeek, overview } from './progress.controller.js';

export const progressRouter = Router();

progressRouter.use(requireAuth);
progressRouter.get('/overview', overview);
progressRouter.get('/exercise/:exerciseName', exerciseByWeek);
