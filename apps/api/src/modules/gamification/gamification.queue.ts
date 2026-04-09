import { Queue, Worker, type JobsOptions } from 'bullmq';

import { env } from '../../config/env.js';
import type { GamificationJobPayload } from './gamification.types.js';

const GAMIFICATION_QUEUE_NAME = 'gamification-workout';
const DEFAULT_ATTEMPTS = 5;
const DEFAULT_BACKOFF_MS = 2000;

type BullConnection = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
  maxRetriesPerRequest: null;
};

let queue: Queue<GamificationJobPayload> | null = null;

function parseBullConnection(): BullConnection | null {
  if (!env.REDIS_URL) {
    return null;
  }

  try {
    const parsed = new URL(env.REDIS_URL);

    const host = parsed.hostname;
    const port = Number.parseInt(parsed.port || '6379', 10);

    if (!host || !Number.isFinite(port)) {
      return null;
    }

    const isTls = parsed.protocol === 'rediss:';

    return {
      host,
      port,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      ...(isTls ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
    };
  } catch {
    return null;
  }
}

function getQueue(): Queue<GamificationJobPayload> | null {
  if (queue) {
    return queue;
  }

  const connection = parseBullConnection();
  if (!connection) {
    return null;
  }

  queue = new Queue<GamificationJobPayload>(GAMIFICATION_QUEUE_NAME, {
    connection,
  });

  return queue;
}

function jobOptions(jobKey: string): JobsOptions {
  return {
    jobId: jobKey,
    attempts: DEFAULT_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: DEFAULT_BACKOFF_MS,
    },
    removeOnComplete: {
      age: 3600,
      count: 3000,
    },
    removeOnFail: {
      age: 24 * 3600,
      count: 3000,
    },
  };
}

export function isGamificationQueueEnabled(): boolean {
  return Boolean(parseBullConnection());
}

export async function enqueueWorkoutGamificationJob(payload: GamificationJobPayload): Promise<boolean> {
  const targetQueue = getQueue();
  if (!targetQueue) {
    return false;
  }

  try {
    await targetQueue.add('process-workout-gamification', payload, jobOptions(payload.jobKey));
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[gamification-queue] enqueue failed', error);
    return false;
  }
}

export function startGamificationWorker(
  processor: (payload: GamificationJobPayload) => Promise<void>,
): Worker<GamificationJobPayload> | null {
  const connection = parseBullConnection();
  if (!connection) {
    return null;
  }

  const worker = new Worker<GamificationJobPayload>(
    GAMIFICATION_QUEUE_NAME,
    async (job) => {
      await processor(job.data);
    },
    {
      connection,
      concurrency: 4,
    },
  );

  worker.on('failed', (job, error) => {
    // eslint-disable-next-line no-console
    console.error('[gamification-queue] worker job failed', {
      jobId: job?.id,
      name: job?.name,
      attemptsMade: job?.attemptsMade,
      error,
    });
  });

  worker.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error('[gamification-queue] worker error', error);
  });

  return worker;
}

export async function closeGamificationQueueResources(): Promise<void> {
  await Promise.allSettled([queue?.close()]);
  queue = null;
}
