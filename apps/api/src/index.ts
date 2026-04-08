import { createServer } from 'node:http';

import { Server } from 'socket.io';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { disconnectRedis } from './utils/redis.js';

const app = createApp();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: env.CORS_ORIGIN,
  },
});

io.on('connection', (socket) => {
  let timerRef: NodeJS.Timeout | null = null;

  socket.on('timer:start', ({ seconds }: { seconds: number }) => {
    if (timerRef) {
      clearInterval(timerRef);
    }

    let remaining = Math.max(0, Math.floor(seconds));
    socket.emit('timer:tick', { remaining });

    timerRef = setInterval(() => {
      remaining -= 1;
      socket.emit('timer:tick', { remaining: Math.max(0, remaining) });

      if (remaining <= 0) {
        if (timerRef) {
          clearInterval(timerRef);
          timerRef = null;
        }
        socket.emit('timer:done');
      }
    }, 1000);
  });

  socket.on('timer:stop', () => {
    if (timerRef) {
      clearInterval(timerRef);
      timerRef = null;
    }
    socket.emit('timer:stopped');
  });

  socket.on('disconnect', () => {
    if (timerRef) {
      clearInterval(timerRef);
      timerRef = null;
    }
  });
});

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.PORT}`);
});

let isShuttingDown = false;

async function gracefulShutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}. Shutting down API...`);

  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });

  await Promise.allSettled([prisma.$disconnect(), disconnectRedis()]);
  process.exit(0);
}

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});
