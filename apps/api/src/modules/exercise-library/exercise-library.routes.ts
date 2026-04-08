import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.js';
import { create, list } from './exercise-library.controller.js';

export const exerciseLibraryRouter = Router();

exerciseLibraryRouter.use(requireAuth);
exerciseLibraryRouter.get('/', list);
exerciseLibraryRouter.post('/', create);
