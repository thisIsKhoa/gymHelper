import type { Request, Response } from 'express';

import { getRedisValue, setRedisValue } from '../../utils/redis.js';

export async function readCachedItem(_req: Request, res: Response) {
  const result = await getRedisValue('item');

  return res.status(200).json({
    result,
  });
}

export async function writeCachedItem(req: Request, res: Response) {
  const value = typeof req.body?.value === 'string' ? req.body.value : null;

  if (!value || value.trim().length === 0) {
    return res.status(400).json({
      message: 'value is required in request body',
    });
  }

  const ok = await setRedisValue('item', value.trim());

  if (!ok) {
    return res.status(503).json({
      message: 'Redis is not configured. Set REDIS_URL to enable cache.',
    });
  }

  return res.status(200).json({
    result: value.trim(),
  });
}
