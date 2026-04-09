import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { consumeNotifications, pingAppActivity, profile } from './gamification.controller.js';

export const gamificationRouter = Router();

gamificationRouter.use(requireAuth);
gamificationRouter.get('/profile', profile);
gamificationRouter.post('/notifications/consume', consumeNotifications);
gamificationRouter.post('/activity/ping', pingAppActivity);
