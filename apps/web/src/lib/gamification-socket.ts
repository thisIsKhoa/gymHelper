import { io, type Socket } from 'socket.io-client';

import { getAuthToken } from './api.ts';

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

async function connectSocket(socketInstance: Socket): Promise<Socket | null> {
  if (socketInstance.connected) {
    return socketInstance;
  }

  return new Promise((resolve) => {
    const handleConnect = () => {
      cleanup();
      resolve(socketInstance);
    };

    const handleConnectError = () => {
      cleanup();
      resolve(null);
    };

    const cleanup = () => {
      socketInstance.off('connect', handleConnect);
      socketInstance.off('connect_error', handleConnectError);
    };

    socketInstance.once('connect', handleConnect);
    socketInstance.once('connect_error', handleConnectError);

    socketInstance.connect();
  });
}

export async function connectGamificationSocket(): Promise<Socket | null> {
  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    const socketInstance = getSocket();
    socketInstance.auth = {
      token: getAuthToken() ?? undefined,
    };

    return connectSocket(socketInstance);
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

  socketInstance.disconnect();
}
