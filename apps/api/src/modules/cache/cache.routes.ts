import { Router } from 'express';

import { readCachedItem, writeCachedItem } from './cache.controller.js';

export const cacheRouter = Router();

cacheRouter.post('/item', readCachedItem);
cacheRouter.put('/item', writeCachedItem);
