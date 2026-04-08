import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../../utils/http-error.js';
import {
  createPlanSchema,
  duplicatePlanSchema,
  sessionPlanTemplateQuerySchema,
  updatePlanSchema,
} from './plan.schemas.js';
import {
  createTrainingPlan,
  duplicateTrainingPlan,
  getSessionPlanTemplate,
  listTrainingPlans,
  updateTrainingPlan,
} from './plan.service.js';

export async function createPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createPlanSchema.parse(req.body);
    const plan = await createTrainingPlan(req.user!.id, input);
    res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
}

export async function listPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const plans = await listTrainingPlans(req.user!.id);
    res.status(200).json(plans);
  } catch (error) {
    next(error);
  }
}

export async function updatePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const rawPlanId = req.params.planId;
    const planId = Array.isArray(rawPlanId) ? rawPlanId[0] : rawPlanId;
    if (!planId) {
      throw new HttpError(400, 'planId is required');
    }

    const input = updatePlanSchema.parse(req.body);
    const plan = await updateTrainingPlan(req.user!.id, planId, input);
    res.status(200).json(plan);
  } catch (error) {
    next(error);
  }
}

export async function duplicatePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const rawPlanId = req.params.planId;
    const planId = Array.isArray(rawPlanId) ? rawPlanId[0] : rawPlanId;
    if (!planId) {
      throw new HttpError(400, 'planId is required');
    }

    const input = duplicatePlanSchema.parse(req.body);
    const duplicated = await duplicateTrainingPlan(req.user!.id, planId, input.name);
    res.status(201).json(duplicated);
  } catch (error) {
    next(error);
  }
}

export async function sessionTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const query = sessionPlanTemplateQuerySchema.parse(req.query);
    const template = await getSessionPlanTemplate(req.user!.id, query.date, query.planId);
    res.status(200).json(template);
  } catch (error) {
    next(error);
  }
}
