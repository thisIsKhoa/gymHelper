import type { MuscleSkill } from '@prisma/client';

import { createRedisIsolatedClient } from '../../utils/redis.js';

const GAMIFICATION_EVENT_CHANNEL = 'gamification:events';

export type AchievementUnlockedRealtimeEvent = {
  type: 'achievement:unlocked';
  userId: string;
  payload: {
    code: string;
    title: string;
    message: string;
    iconKey: string;
  };
};

export type MuscleLevelUpRealtimeEvent = {
  type: 'muscle:levelup';
  userId: string;
  payload: {
    skill: MuscleSkill;
    level: number;
    title: string;
    message: string;
  };
};

export type GamificationRealtimeEvent = AchievementUnlockedRealtimeEvent | MuscleLevelUpRealtimeEvent;

let publisherPromise: Promise<Awaited<ReturnType<typeof createRedisIsolatedClient>>> | null = null;

function toUserRoom(userId: string): string {
  return `user_room_${userId}`;
}

export function userRoomName(userId: string): string {
  return toUserRoom(userId);
}

async function getPublisher() {
  if (!publisherPromise) {
    publisherPromise = createRedisIsolatedClient();
  }

  return publisherPromise;
}

export async function publishGamificationRealtimeEvent(event: GamificationRealtimeEvent): Promise<void> {
  const publisher = await getPublisher();
  if (!publisher) {
    return;
  }

  await publisher.publish(GAMIFICATION_EVENT_CHANNEL, JSON.stringify(event));
}

export async function subscribeGamificationRealtimeEvents(
  onEvent: (event: GamificationRealtimeEvent) => void,
): Promise<(() => Promise<void>) | null> {
  const subscriber = await createRedisIsolatedClient();
  if (!subscriber) {
    return null;
  }

  await subscriber.subscribe(GAMIFICATION_EVENT_CHANNEL, (rawMessage) => {
    try {
      const parsed = JSON.parse(rawMessage) as GamificationRealtimeEvent;
      if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string' || typeof parsed.userId !== 'string') {
        return;
      }

      onEvent(parsed);
    } catch {
      // ignore malformed realtime payloads
    }
  });

  return async () => {
    try {
      await subscriber.unsubscribe(GAMIFICATION_EVENT_CHANNEL);
    } finally {
      try {
        await subscriber.quit();
      } catch {
        await subscriber.disconnect();
      }
    }
  };
}
