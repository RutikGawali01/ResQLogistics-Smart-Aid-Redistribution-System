import { Server } from 'socket.io';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@aidflow/shared';

let ioInstance = null;

export function initSocketServer(httpServer, corsOrigin) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: corsOrigin || '*',
      methods: ['GET', 'POST']
    }
  });

  ioInstance.on(SOCKET_EVENTS.CONNECTION, (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join room handler
    socket.on(SOCKET_EVENTS.JOIN_ROOM, ({ room }) => {
      if (room) {
        socket.join(room);
        console.log(`[Socket.IO] Client ${socket.id} joined ${room}`);
      }
    });

    // Leave room handler
    socket.on(SOCKET_EVENTS.LEAVE_ROOM, ({ room }) => {
      if (room) {
        socket.leave(room);
        console.log(`[Socket.IO] Client ${socket.id} left ${room}`);
      }
    });

    // Real-time rider location updates
    socket.on(SOCKET_EVENTS.RIDER_LOCATION_UPDATE, (data) => {
      // Broadcast to dispatchers and any room tracking this rider or assignment
      if (data?.riderId) {
        socket.to(SOCKET_ROOMS.GLOBAL_DISPATCH).emit(SOCKET_EVENTS.RIDER_LOCATION_BROADCAST, data);
        if (data?.assignmentId) {
          socket.to(SOCKET_ROOMS.ASSIGNMENT(data.assignmentId)).emit(SOCKET_EVENTS.RIDER_LOCATION_BROADCAST, data);
        }
      }
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return ioInstance;
}

export function getIO() {
  return ioInstance;
}

export function broadcastEvent(eventName, payload, room = null) {
  if (!ioInstance) return;
  if (room) {
    ioInstance.to(room).emit(eventName, payload);
  } else {
    ioInstance.emit(eventName, payload);
  }
}
