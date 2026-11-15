import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { config } from './config.js';
import { connectDatabase } from './db.js';
import { logger } from './logger.js';
import { setupSocketIO } from './socket/index.js';
import { closeStaleGames } from './services/cleanup.js';

export function createHttpServer(app = createApp()) {
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: {
      origin: config.CLIENT_ORIGINS.includes('*') ? '*' : config.CLIENT_ORIGINS.split(','),
      methods: ['GET', 'POST'],
    },
  });

  setupSocketIO(io);

  return { server, app, io };
}

async function bootstrap() {
  await connectDatabase();

  // Matches running when the server last stopped can't resume (state lives in memory): close them
  await closeStaleGames();
  const cleanupTimer = setInterval(() => void closeStaleGames(), 10 * 60 * 1000);
  cleanupTimer.unref();

  const { server, app, io } = createHttpServer();

  server.listen(config.PORT, () => {
    logger.info(`MANHUNT LIVE server running on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  return { app, server, io };
}

// Start server when executed directly
if (process.env.NODE_ENV !== 'test') {
  bootstrap().catch((err) => {
    logger.error('Failed to start server:', err);
    process.exit(1);
  });
}
