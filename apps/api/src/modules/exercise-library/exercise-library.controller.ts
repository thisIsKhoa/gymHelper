import type { NextFunction, Request, Response } from 'express';

import { createCustomExerciseSchema, exerciseLibraryQuerySchema } from './exercise-library.schemas.js';
import { createCustomExercise, listExerciseLibrary } from './exercise-library.service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = exerciseLibraryQuerySchema.parse(req.query);
    const result = await listExerciseLibrary(req.user!.id, query.search);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createCustomExerciseSchema.parse(req.body);
    const result = await createCustomExercise(req.user!.id, input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
