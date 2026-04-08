import { createClient } from 'redis';

import { env } from '../config/env.js';

type AppRedisClient = ReturnType<typeof createClient>;

let redisClient: AppRedisClient | null = null;
let connectInFlight: Promise<AppRedisClient | null> | null = null;

function cacheKey(key: string): string {
  const trimmed = key.trim();
  return `${env.REDIS_KEY_PREFIX}${trimmed}`;
}

export async function getRedisClient(): Promise<AppRedisClient | null> {
  if (!env.REDIS_URL) {
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (connectInFlight) {
    return connectInFlight;
  }

  const client = createClient({
    url: env.REDIS_URL,
  });

  client.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error('[redis] client error', error);
  });

  connectInFlight = client
    .connect()
    .then(() => {
      redisClient = client;
      return redisClient;
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('[redis] connect failed', error);
      return null;
    })
    .finally(() => {
      connectInFlight = null;
    });

  return connectInFlight;
}

export async function getRedisValue(key: string): Promise<string | null> {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  return client.get(cacheKey(key));
}

export async function setRedisValue(key: string, value: string): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  await client.set(cacheKey(key), value);
  return true;
}
