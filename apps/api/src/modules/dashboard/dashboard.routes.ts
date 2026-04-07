import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { overview } from './dashboard.controller.js';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.get('/overview', overview);
