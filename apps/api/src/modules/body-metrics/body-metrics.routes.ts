import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { create, history, latest } from './body-metrics.controller.js';

export const bodyMetricsRouter = Router();

bodyMetricsRouter.use(requireAuth);
bodyMetricsRouter.post('/', create);
bodyMetricsRouter.get('/history', history);
bodyMetricsRouter.get('/latest', latest);
