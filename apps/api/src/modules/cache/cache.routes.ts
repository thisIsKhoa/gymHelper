import { Router } from 'express';

import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { readCachedItem, writeCachedItem } from './cache.controller.js';

export const cacheRouter = Router();

cacheRouter.use(requireAuth, requireAdmin);

cacheRouter.get('/item', readCachedItem);
cacheRouter.post('/item', readCachedItem);
cacheRouter.put('/item', writeCachedItem);
