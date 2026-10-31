import { Server } from 'socket.io';
import { socketAuthMiddleware, AuthenticatedSocket } from './auth.js';
import { registerLobbyHandlers } from './lobbyHandler.js';
import { logger } from '../logger.js';

export function setupSocketIO(io: Server) {
  // Use JWT authentication middleware for every incoming connection
  io.use(socketAuthMiddleware);

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.data.user;
    logger.info(`Socket connected: ${socket.id} (user: ${user?.username} / ${user?.userId})`);

    // Register lobby handlers
    registerLobbyHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (reason: ${reason})`);
    });
  });

  return io;
}
