import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  workerId: `worker-${process.pid}-${Math.random().toString(36).substring(2, 7)}`,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/aidflow',
  pollIntervalMs: parseInt(process.env.WORKER_POLL_INTERVAL_MS || '3000', 10),
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  lockTimeoutMs: parseInt(process.env.WORKER_LOCK_TIMEOUT_MS || '60000', 10),
  maxRetries: parseInt(process.env.WORKER_MAX_RETRIES || '3', 10)
};
