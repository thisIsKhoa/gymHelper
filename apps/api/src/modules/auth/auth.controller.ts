import type { CookieOptions, NextFunction, Request, Response } from 'express';

import { env } from '../../config/env.js';
import { getProfile, loginUser, registerUser } from './auth.service.js';
import { AUTH_ACCESS_COOKIE } from './auth.constants.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

type CookieSameSite = NonNullable<CookieOptions['sameSite']>;

function parseJwtExpiresInToMs(value: string): number | undefined {
  const match = value.trim().match(/^(\d+)([smhd])$/i);
  if (!match) {
    return undefined;
  }

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();

  if (!Number.isFinite(amount) || amount <= 0 || !unit) {
    return undefined;
  }

  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60_000;
    case 'h':
      return amount * 3_600_000;
    case 'd':
      return amount * 86_400_000;
    default:
      return undefined;
  }
}

function resolveCookieSameSite(): CookieSameSite {
  if (env.AUTH_COOKIE_SAME_SITE) {
    return env.AUTH_COOKIE_SAME_SITE;
  }

  return env.NODE_ENV === 'production' ? 'none' : 'lax';
}

function resolveCookieSecure(sameSite: CookieSameSite): boolean {
  const secureFromEnv = env.AUTH_COOKIE_SECURE
    ? env.AUTH_COOKIE_SECURE === 'true'
    : env.NODE_ENV === 'production';

  // Browsers reject SameSite=None unless Secure is enabled.
  return sameSite === 'none' ? true : secureFromEnv;
}

function buildCookieOptions(): CookieOptions {
  const maxAge = parseJwtExpiresInToMs(env.JWT_EXPIRES_IN);
  const sameSite = resolveCookieSameSite();
  const secure = resolveCookieSecure(sameSite);

  return {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    ...(typeof maxAge === 'number' ? { maxAge } : {}),
  };
}

function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_ACCESS_COOKIE, token, buildCookieOptions());
}

function clearAuthCookie(res: Response): void {
  const cookieOptions = buildCookieOptions();

  res.clearCookie(AUTH_ACCESS_COOKIE, {
    httpOnly: cookieOptions.httpOnly,
    sameSite: cookieOptions.sameSite,
    secure: cookieOptions.secure,
    path: cookieOptions.path,
  });
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = registerSchema.parse(req.body);
    const result = await registerUser(input);
    setAuthCookie(res, result.token);
    res.status(201).json({ user: result.user });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.parse(req.body);
    const result = await loginUser(input);
    setAuthCookie(res, result.token);
    res.status(200).json({ user: result.user });
  } catch (error) {
    next(error);
  }
}

export function logout(_req: Request, res: Response) {
  clearAuthCookie(res);
  res.status(200).json({ message: 'Logged out' });
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await getProfile(req.user!.id);
    res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
}
