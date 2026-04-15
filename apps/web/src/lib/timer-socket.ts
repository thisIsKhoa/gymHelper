import { io, type Socket } from 'socket.io-client'

import { getAuthToken } from './api.ts'

let socket: Socket | null = null

export function getTimerSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000', {
      autoConnect: false,
      transports: ['websocket'],
      withCredentials: true,
    })
  }

  socket.auth = {
    token: getAuthToken() ?? undefined,
  }

  return socket
}
