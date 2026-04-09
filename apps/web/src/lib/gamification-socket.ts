import { io, type Socket } from 'socket.io-client';

import { apiRequest } from './api.ts';

interface AuthMeResponse {
  id: string;
}

interface AchievementUnlockedPayload {
  code: string;
  title: string;
  message: string;
  iconKey: string;
}

interface MuscleLevelUpPayload {
  skill: string;
  level: number;
  title: string;
  message: string;
}

let socket: Socket | null = null;
let activeUserId: string | null = null;
let connectingPromise: Promise<Socket | null> | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000', {
      autoConnect: false,
      transports: ['websocket'],
      withCredentials: true,
    });
  }

  return socket;
}

async function resolveCurrentUserId(): Promise<string | null> {
  try {
    const result = await apiRequest<AuthMeResponse>('/auth/me', 'GET');
    return result.id;
  } catch {
    return null;
  }
}

export async function connectGamificationSocket(): Promise<Socket | null> {
  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return null;
    }

    const socketInstance = getSocket();

    if (!socketInstance.connected) {
      socketInstance.connect();
    }

    if (activeUserId && activeUserId !== userId) {
      socketInstance.emit('user:leave', { userId: activeUserId });
    }

    activeUserId = userId;
    socketInstance.emit('user:join', { userId });

    return socketInstance;
  })().finally(() => {
    connectingPromise = null;
  });

  return connectingPromise;
}

export function onAchievementUnlocked(handler: (payload: AchievementUnlockedPayload) => void): () => void {
  const socketInstance = getSocket();
  socketInstance.on('achievement:unlocked', handler);

  return () => {
    socketInstance.off('achievement:unlocked', handler);
  };
}

export function onMuscleLevelUp(handler: (payload: MuscleLevelUpPayload) => void): () => void {
  const socketInstance = getSocket();
  socketInstance.on('muscle:levelup', handler);

  return () => {
    socketInstance.off('muscle:levelup', handler);
  };
}

export function disconnectGamificationSocket(): void {
  const socketInstance = socket;
  if (!socketInstance) {
    return;
  }

  if (activeUserId) {
    socketInstance.emit('user:leave', { userId: activeUserId });
  }

  activeUserId = null;
  socketInstance.disconnect();
}
