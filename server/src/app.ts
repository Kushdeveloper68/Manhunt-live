import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { gamesRouter } from './routes/games.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Base routes
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/games', gamesRouter);

  // 404 handler
  app.use('*', (_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
