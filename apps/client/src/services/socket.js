import { io } from 'socket.io-client';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@aidflow/shared';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;
let statusListeners = new Set();
let currentStatus = 'offline';

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 5000,
      timeout: 6000,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to AidFlow real-time hub (ID:', socket.id, ')');
      currentStatus = 'connected';
      // Automatically join global dispatch room for live telematics
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { room: SOCKET_ROOMS.GLOBAL_DISPATCH });
      notifyStatusListeners('connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason);
      currentStatus = 'disconnected';
      notifyStatusListeners('disconnected');
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket.IO] Connection error:', error.message);
      currentStatus = 'offline';
      notifyStatusListeners('offline');
    });

    socket.on('reconnect_attempt', (attempt) => {
      currentStatus = 'reconnecting';
      notifyStatusListeners('reconnecting');
    });

    socket.on('reconnect', (attempt) => {
      console.log('[Socket.IO] Reconnected after attempt', attempt);
      currentStatus = 'connected';
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { room: SOCKET_ROOMS.GLOBAL_DISPATCH });
      notifyStatusListeners('connected');
    });
  }

  return socket;
}

function notifyStatusListeners(status) {
  statusListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (e) {
      console.error('[Socket.IO] Status listener error:', e);
    }
  });
}

export function connectSocket(onStatusChange) {
  if (onStatusChange) {
    statusListeners.add(onStatusChange);
    // Notify immediately of current status
    onStatusChange(currentStatus);
  }

  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(onStatusChange) {
  if (onStatusChange) {
    statusListeners.delete(onStatusChange);
  }
  if (statusListeners.size === 0 && socket) {
    socket.disconnect();
    socket = null;
    currentStatus = 'offline';
  }
}

export function isSocketConnected() {
  return socket?.connected ?? false;
}

export function getSocketStatus() {
  return currentStatus;
}

export function joinRoom(room) {
  if (socket && room) {
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, { room });
  }
}

export function leaveRoom(room) {
  if (socket && room) {
    socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { room });
  }
}

export function subscribeToEvent(eventName, callback) {
  const s = getSocket();
  s.on(eventName, callback);
  return () => {
    s.off(eventName, callback);
  };
}
