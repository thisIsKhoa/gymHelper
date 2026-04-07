import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { login, me, register } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.get('/me', requireAuth, me);
