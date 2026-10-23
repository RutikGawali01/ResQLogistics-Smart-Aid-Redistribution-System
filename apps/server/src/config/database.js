import mongoose from 'mongoose';
import { config } from './env.js';

let isConnected = false;

export async function connectDatabase() {
  if (isConnected) return mongoose.connection;

  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 3000
    });
    isConnected = true;
    console.log(`[Database] MongoDB connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (err) {
    console.warn(`[Database] Warning: Could not connect to MongoDB at "${config.mongoUri}": ${err.message}`);
    console.warn(`[Database] Server will proceed in decoupled/mock mode. Set MONGODB_URI in .env when ready.`);
    isConnected = false;
    return null;
  }
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDatabase() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}
