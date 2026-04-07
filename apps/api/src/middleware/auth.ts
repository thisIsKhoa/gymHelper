import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

interface JwtPayload {
  sub: string;
  email: string;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    next(new HttpError(401, 'Authentication required'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      id: payload.sub,
      email: payload.email,
    };
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}
