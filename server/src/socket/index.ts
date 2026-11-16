import { Server } from 'socket.io';
import { socketAuthMiddleware, AuthenticatedSocket } from './auth.js';
import { registerLobbyHandlers } from './lobbyHandler.js';
import { registerLocationHandlers } from './locationHandler.js';
import { registerSafetyHandlers } from './safetyHandler.js';
import { registerTagHandlers } from './tagHandler.js';
import { gameLoopManager } from '../game/gameLoop.js';
import { setPresenceIo, userRoom } from './presence.js';
import { User } from '../models/User.js';
import { EventRateLimiter } from '../game/antiCheat.js';
import { logger } from '../logger.js';

export function setupSocketIO(io: Server) {
  // Initialize game loop with io instance
  gameLoopManager.init(io);
  setPresenceIo(io);

  // Use JWT authentication middleware for every incoming connection
  io.use(socketAuthMiddleware);

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.data.user;
    logger.info(`Socket connected: ${socket.id} (user: ${user?.username} / ${user?.userId})`);

    // Personal room: lets us reach this user's devices anywhere (invites, friend requests) + presence
    if (user?.userId) void socket.join(userRoom(user.userId));

    // Flood protection: ~8 events/s is plenty (location updates come once a second)
    const limiter = new EventRateLimiter(40, 5000, 25);
    socket.use((_packet, next) => {
      const verdict = limiter.hit();
      if (verdict === 'ok') return next();
      if (verdict === 'disconnect') {
        logger.warn(`Socket ${socket.id} (@${user?.username}) disconnected for flooding`);
        socket.disconnect(true);
        return;
      }
      next(new Error('rate_limited'));
    });

    // Register lobby, location, safety & tag handlers
    registerLobbyHandlers(io, socket);
    registerLocationHandlers(io, socket);
    registerSafetyHandlers(io, socket);
    registerTagHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (reason: ${reason})`);
      if (user?.userId) {
        User.updateOne({ _id: user.userId }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
      }
    });
  });

  return io;
}
