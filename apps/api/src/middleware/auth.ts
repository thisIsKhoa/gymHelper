import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { AUTH_ACCESS_COOKIE } from '../modules/auth/auth.constants.js';
import { HttpError } from '../utils/http-error.js';

interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthHeaderSource {
  cookie?: string;
  authorization?: string;
}

export function readCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    if (!rawName || rawName !== name) {
      continue;
    }

    const rawValue = rawValueParts.join('=').trim();
    return rawValue ? decodeURIComponent(rawValue) : null;
  }

  return null;
}

export function resolveAuthTokenFromHeaders(headers: AuthHeaderSource): string | null {
  const cookieToken = readCookieValue(headers.cookie, AUTH_ACCESS_COOKIE);
  if (cookieToken) {
    return cookieToken;
  }

  const authHeader = headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearerToken) {
    return bearerToken;
  }

  return null;
}

export function resolveAuthToken(req: Request): string | null {
  return resolveAuthTokenFromHeaders({
    cookie: req.headers.cookie,
    authorization: req.headers.authorization,
  });
}

export function verifyAuthToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const userId = typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
    const userEmail = typeof payload.email === 'string' ? payload.email : '';

    if (!userId || !userEmail) {
      return null;
    }

    return {
      id: userId,
      email: userEmail,
    };
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = resolveAuthToken(req);

  if (!token) {
    next(new HttpError(401, 'Authentication required'));
    return;
  }

  const user = verifyAuthToken(token);
  if (!user) {
    next(new HttpError(401, 'Invalid or expired token'));
    return;
  }

  req.user = user;
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const normalizedEmail = req.user?.email.trim().toLowerCase();
  if (!normalizedEmail) {
    next(new HttpError(401, 'Authentication required'));
    return;
  }

  const adminEmails = env.ADMIN_EMAILS.split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    next(new HttpError(403, 'Admin access is not configured'));
    return;
  }

  if (!adminEmails.includes(normalizedEmail)) {
    next(new HttpError(403, 'Admin access required'));
    return;
  }

  next();
}
