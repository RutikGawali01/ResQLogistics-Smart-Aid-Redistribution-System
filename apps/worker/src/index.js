import mongoose from 'mongoose';
import { config } from './config/env.js';
import { JobQueue } from './queue/JobQueue.js';
import { expirationCheckerHandler } from './handlers/expirationChecker.js';
import { dispatchOptimizerHandler } from './handlers/dispatchOptimizer.js';

async function startWorker() {
  console.log(`\n======================================================`);
  console.log(`⚙️  AidFlow Background Worker (${config.workerId})`);
  console.log(`📦 Architecture: MongoDB Atomic Queue (Strictly NO Redis)`);
  console.log(`⏱️  Poll Interval: ${config.pollIntervalMs}ms | Concurrency: ${config.concurrency}`);
  console.log(`======================================================\n`);

  // Attempt database connection
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log('[Worker DB] Connected to MongoDB for persistent queue processing');
  } catch (err) {
    console.warn(`[Worker DB] Warning: MongoDB not reachable (${err.message}).`);
    console.warn('[Worker DB] Worker operating in in-memory simulation mode.');
  }

  const queue = new JobQueue({
    workerId: config.workerId,
    pollIntervalMs: config.pollIntervalMs,
    concurrency: config.concurrency,
    lockTimeoutMs: config.lockTimeoutMs,
    maxRetries: config.maxRetries
  });

  // Register task handlers
  queue.registerHandler('EXPIRATION_CHECKER', expirationCheckerHandler);
  queue.registerHandler('DISPATCH_OPTIMIZER', dispatchOptimizerHandler);

  // Enqueue initial maintenance tasks
  await queue.enqueue('EXPIRATION_CHECKER', { thresholdHours: 12 });
  await queue.enqueue('DISPATCH_OPTIMIZER', { autoDispatch: true });

  // Periodically enqueue recurring background cycles (every 60s)
  const recurringTimer = setInterval(async () => {
    if (queue.isRunning) {
      await queue.enqueue('EXPIRATION_CHECKER', { thresholdHours: 12 });
      await queue.enqueue('DISPATCH_OPTIMIZER', { autoDispatch: true });
    }
  }, 60000);

  // Start the queue polling engine
  queue.start();

  // Handle graceful termination
  const shutdown = async (signal) => {
    console.log(`\n[Worker] Received ${signal}. Initiating graceful worker shutdown...`);
    clearInterval(recurringTimer);
    await queue.stop();
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startWorker().catch((err) => {
  console.error('[Worker Fatal] Startup error:', err);
  process.exit(1);
});
