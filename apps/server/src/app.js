import express from 'express';
import cors from 'cors';
import { ENDPOINT_PREFIXES, ERROR_CODES } from '@aidflow/shared';
import { config } from './config/env.js';
import { responseFormatMiddleware } from './middleware/responseFormat.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route handlers
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import donationsRoutes from './routes/donations.routes.js';
import sheltersRoutes from './routes/shelters.routes.js';
import ridersRoutes from './routes/riders.routes.js';
import dispatchRoutes from './routes/dispatch.routes.js';
import assignmentsRoutes from './routes/assignments.routes.js';
import eventsRoutes from './routes/events.routes.js';

export function createApp() {
  const app = express();

  // Core middleware
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(responseFormatMiddleware);

  // Mount agreed API route prefixes
  app.use(ENDPOINT_PREFIXES.HEALTH, healthRoutes);
  app.use(ENDPOINT_PREFIXES.AUTH, authRoutes);
  app.use(ENDPOINT_PREFIXES.DONATIONS, donationsRoutes);
  app.use(ENDPOINT_PREFIXES.SHELTERS, sheltersRoutes);
  app.use(ENDPOINT_PREFIXES.RIDERS, ridersRoutes);
  app.use(ENDPOINT_PREFIXES.DISPATCH, dispatchRoutes);
  app.use(ENDPOINT_PREFIXES.ASSIGNMENTS, assignmentsRoutes);
  app.use('/api/events', eventsRoutes);

  // 404 handler adhering to standard error contract
  app.use((req, res) => {
    return res.fail(
      ERROR_CODES.NOT_FOUND,
      `Cannot ${req.method} ${req.originalUrl} - Resource not found`,
      null,
      404
    );
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
