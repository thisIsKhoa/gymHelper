import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';

const REQUEST_METRIC_SAMPLE_SIZE = 200;
const REQUEST_METRIC_LOG_INTERVAL = 50;

const requestDurationSamples = new Map<string, number[]>();
const requestSampleCounts = new Map<string, number>();

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return Number((sorted[index] ?? 0).toFixed(2));
}

function recordRequestMetric(routeKey: string, durationMs: number): { count: number; p50: number; p95: number } {
  const samples = requestDurationSamples.get(routeKey) ?? [];
  samples.push(durationMs);
  if (samples.length > REQUEST_METRIC_SAMPLE_SIZE) {
    samples.shift();
  }
  requestDurationSamples.set(routeKey, samples);

  const count = (requestSampleCounts.get(routeKey) ?? 0) + 1;
  requestSampleCounts.set(routeKey, count);

  return {
    count,
    p50: percentile(samples, 0.5),
    p95: percentile(samples, 0.95),
  };
}

export function createApp() {
  const app = express();

  const authLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message: 'Too many authentication requests. Please try again shortly.',
    },
  });

  const workoutLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.WORKOUT_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message: 'Too many workout requests. Please slow down and retry.',
    },
  });

  const morganFormat = env.NODE_ENV === 'production' ? 'combined' : 'dev';

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(compression({ threshold: 1024 }));
  app.use(express.json({ limit: '1mb' }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(morganFormat));
    app.use((req, res, next) => {
      const startedAt = process.hrtime.bigint();

      res.on('finish', () => {
        const elapsedNs = process.hrtime.bigint() - startedAt;
        const elapsedMs = Number(elapsedNs) / 1_000_000;
        const routeKey = `${req.method} ${req.path}`;
        const { count, p50, p95 } = recordRequestMetric(routeKey, elapsedMs);

        if (elapsedMs >= env.HTTP_SLOW_REQUEST_MS) {
          // eslint-disable-next-line no-console
          console.warn(
            `[http] slow request ${req.method} ${req.originalUrl} -> ${res.statusCode} (${elapsedMs.toFixed(2)}ms)`,
          );
        }

        if (count % REQUEST_METRIC_LOG_INTERVAL === 0) {
          // eslint-disable-next-line no-console
          console.info(`[http] metrics ${routeKey} count=${count} p50=${p50}ms p95=${p95}ms`);
        }
      });

      next();
    });
  }

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  if (env.NODE_ENV !== 'test') {
    app.use('/api/v1/auth', authLimiter);
    app.use('/api/v1/workouts', workoutLimiter);
  }

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
