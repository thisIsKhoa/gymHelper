import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { HttpError } from '../utils/http-error.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, 'Route not found'));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: 'Validation error',
      issues: error.issues,
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    });
    return;
  }

  res.status(500).json({
    message: 'Internal server error',
  });
}
