import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
