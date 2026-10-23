import http from 'http';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { initSocketServer } from './socket/index.js';

async function startServer() {
  const app = createApp();
  const httpServer = http.createServer(app);

  // Initialize Socket.IO
  initSocketServer(httpServer, config.corsOrigin);

  // Attempt database connection and seed demo accounts if connected
  const conn = await connectDatabase();
  if (conn) {
    try {
      const { seedUsers } = await import('./seeds/seedUsers.js');
      await seedUsers();
    } catch (e) {
      console.warn('[Server] Notice on demo account auto-seed:', e.message);
    }
  }

  httpServer.listen(config.port, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 AidFlow API Server listening on port ${config.port}`);
    console.log(`🌐 Base URL: http://${config.host}:${config.port}`);
    console.log(`🔌 Health Check: http://${config.host}:${config.port}/api/health`);
    console.log(`📡 Socket.IO initialized on same port`);
    console.log(`======================================================\n`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    httpServer.close(() => {
      console.log('[Server] HTTP and Socket server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('[Server Fatal] Startup failure:', err);
  process.exit(1);
});
