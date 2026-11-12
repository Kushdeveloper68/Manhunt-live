import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { gamesRouter } from './routes/games.js';
import { friendsRouter } from './routes/friends.js';
import { errorHandler } from './middleware/errorHandler.js';
import { config } from './config.js';

export function createApp() {
  const app = express();

  // Native apps send no Origin header, so CORS only matters for web clients.
  const origins = config.CLIENT_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors(origins.includes('*') ? undefined : { origin: origins }));
  app.use(express.json({ limit: '100kb' }));

  // Base routes
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/friends', friendsRouter);

  // 404 handler
  app.use('*', (_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
