import type { NextFunction, Request, Response } from 'express';

import { getProfile, loginUser, registerUser } from './auth.service.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = registerSchema.parse(req.body);
    const result = await registerUser(input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.parse(req.body);
    const result = await loginUser(input);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await getProfile(req.user!.id);
    res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
}
