import { prisma } from '../../db/prisma.js';
import { disconnectRedis } from '../../utils/redis.js';
import { closeGamificationQueueResources, startGamificationWorker } from './gamification.queue.js';
import { processWorkoutGamificationJob } from './gamification.service.js';

const worker = startGamificationWorker(async (payload) => {
  await processWorkoutGamificationJob(payload);
});

if (!worker) {
  // eslint-disable-next-line no-console
  console.warn('[gamification-worker] Redis unavailable. Worker not started.');
} else {
  // eslint-disable-next-line no-console
  console.log('[gamification-worker] started and waiting for jobs');
}

let shuttingDown = false;

async function gracefulShutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  // eslint-disable-next-line no-console
  console.log(`[gamification-worker] received ${signal}, shutting down...`);

  await Promise.allSettled([
    worker?.close(),
    closeGamificationQueueResources(),
    prisma.$disconnect(),
    disconnectRedis(),
  ]);

  process.exit(0);
}

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});
