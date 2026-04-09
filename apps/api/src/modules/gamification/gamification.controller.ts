import type { NextFunction, Request, Response } from 'express';

import { appActivityPingSchema, consumeNotificationsSchema } from './gamification.schemas.js';
import {
  consumeGamificationNotifications,
  getGamificationProfile,
  recordDailyAppOpen,
} from './gamification.service.js';

export async function profile(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getGamificationProfile(req.user!.id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

export async function consumeNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const input = consumeNotificationsSchema.parse(req.body ?? {});
    const notifications = await consumeGamificationNotifications(req.user!.id, input.limit ?? 10);
    res.status(200).json({
      items: notifications,
      count: notifications.length,
    });
  } catch (error) {
    next(error);
  }
}

export async function pingAppActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const input = appActivityPingSchema.parse(req.body ?? {});
    await recordDailyAppOpen(req.user!.id, input.at ?? new Date());
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
