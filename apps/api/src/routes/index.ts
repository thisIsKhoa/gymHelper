import { Router } from 'express';

import { authRouter } from '../modules/auth/auth.routes.js';
import { bodyMetricsRouter } from '../modules/body-metrics/body-metrics.routes.js';
import { cacheRouter } from '../modules/cache/cache.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { exerciseLibraryRouter } from '../modules/exercise-library/exercise-library.routes.js';
import { gamificationRouter } from '../modules/gamification/gamification.routes.js';
import { planRouter } from '../modules/plan/plan.routes.js';
import { progressRouter } from '../modules/progress/progress.routes.js';
import { workoutRouter } from '../modules/workout/workout.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/workouts', workoutRouter);
apiRouter.use('/exercises', exerciseLibraryRouter);
apiRouter.use('/body-metrics', bodyMetricsRouter);
apiRouter.use('/cache', cacheRouter);
apiRouter.use('/plans', planRouter);
apiRouter.use('/progress', progressRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/gamification', gamificationRouter);
