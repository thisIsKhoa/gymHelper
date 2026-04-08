import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { createPlan, duplicatePlan, listPlans, sessionTemplate, updatePlan } from './plan.controller.js';

export const planRouter = Router();

planRouter.use(requireAuth);
planRouter.post('/', createPlan);
planRouter.get('/', listPlans);
planRouter.get('/session-template', sessionTemplate);
planRouter.put('/:planId', updatePlan);
planRouter.post('/:planId/duplicate', duplicatePlan);
