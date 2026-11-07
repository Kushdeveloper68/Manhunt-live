import { Server } from 'socket.io';
import { socketAuthMiddleware, AuthenticatedSocket } from './auth.js';
import { registerLobbyHandlers } from './lobbyHandler.js';
import { registerLocationHandlers } from './locationHandler.js';
import { registerSafetyHandlers } from './safetyHandler.js';
import { registerTagHandlers } from './tagHandler.js';
import { gameLoopManager } from '../game/gameLoop.js';
import { logger } from '../logger.js';

export function setupSocketIO(io: Server) {
  // Initialize game loop with io instance
  gameLoopManager.init(io);

  // Use JWT authentication middleware for every incoming connection
  io.use(socketAuthMiddleware);

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.data.user;
    logger.info(`Socket connected: ${socket.id} (user: ${user?.username} / ${user?.userId})`);

    // Register lobby, location, safety & tag handlers
    registerLobbyHandlers(io, socket);
    registerLocationHandlers(io, socket);
    registerSafetyHandlers(io, socket);
    registerTagHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (reason: ${reason})`);
    });
  });

  return io;
}
