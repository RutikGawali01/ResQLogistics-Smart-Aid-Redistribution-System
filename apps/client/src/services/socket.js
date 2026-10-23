import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '@aidflow/shared';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 5000
    });
  }
  return socket;
}

export function connectSocket(onStatusChange) {
  const s = getSocket();

  s.on(SOCKET_EVENTS.CONNECT, () => {
    console.log('[Client Socket] Connected to AidFlow real-time hub');
    if (onStatusChange) onStatusChange('connected');
  });

  s.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
    console.log('[Client Socket] Disconnected:', reason);
    if (onStatusChange) onStatusChange('disconnected');
  });

  s.on('connect_error', () => {
    if (onStatusChange) onStatusChange('offline');
  });

  s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
