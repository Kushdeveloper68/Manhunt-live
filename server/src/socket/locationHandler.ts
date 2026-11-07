import { Server } from 'socket.io';
import { z } from 'zod';
import { SOCKET_EVENTS, LivePlayerLocation } from '@manhunt/shared';
import { gameStateStore } from '../game/gameStateStore.js';
import { isImpossibleSpeedJump } from '../game/math.js';
import { AuthenticatedSocket } from './auth.js';
import { logger } from '../logger.js';

const locationUpdateSchema = z.object({
  gameId: z.string().min(1),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  speed: z.number().optional(),
  heading: z.number().optional(),
  accuracy: z.number().optional(),
  isMock: z.boolean().optional(),
  timestamp: z.number(),
});

// Per-socket rate limiter: max 1 location update every 900ms
const lastUpdateMap = new Map<string, number>();

export function registerLocationHandlers(io: Server, socket: AuthenticatedSocket) {
  const user = socket.data.user!;

  socket.on(SOCKET_EVENTS.LOCATION_UPDATE, async (payload: unknown) => {
    try {
      // 1. Rate limiting
      const now = Date.now();
      const last = lastUpdateMap.get(user.userId) || 0;
      if (now - last < 900) {
        return; // drop spamming updates
      }
      lastUpdateMap.set(user.userId, now);

      // 2. Validate payload
      const data = locationUpdateSchema.parse(payload);
      const state = await gameStateStore.get(data.gameId);
      if (!state || state.status === 'ended') return;

      const player = state.players.find((p) => p.userId === user.userId);
      if (!player || player.status !== 'ACTIVE') return;

      const newLocation: LivePlayerLocation = {
        userId: user.userId,
        username: player.username,
        role: player.role,
        coordinates: data.coordinates,
        speed: data.speed,
        heading: data.heading,
        accuracy: data.accuracy,
        timestamp: data.timestamp || now,
        isMock: data.isMock,
      };

      // 3. Anti-Cheat Checks
      if (data.isMock) {
        logger.warn(`[ANTI-CHEAT] Mock location detected for user @${player.username} (${user.userId})`);
      }

      const prevLocation = state.locations.get(user.userId);
      if (prevLocation && isImpossibleSpeedJump(prevLocation, newLocation)) {
        logger.warn(
          `[ANTI-CHEAT] Impossible speed jump detected for @${player.username}: ` +
          `from (${prevLocation.coordinates.latitude}, ${prevLocation.coordinates.longitude}) ` +
          `to (${newLocation.coordinates.latitude}, ${newLocation.coordinates.longitude})`
        );
      }

      // 4. Update GameStateStore
      state.locations.set(user.userId, newLocation);
      await gameStateStore.set(data.gameId, state);

      // 5. Visibility delivery: Send live location ONLY to teammates
      const roomName = `game:${data.gameId}`;
      const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
      if (socketsInRoom) {
        for (const sockId of socketsInRoom) {
          const targetSock = io.sockets.sockets.get(sockId) as AuthenticatedSocket;
          if (targetSock && targetSock.data?.user) {
            const targetPlayer = state.players.find(
              (p) => p.userId === targetSock.data.user?.userId
            );

            // Teammates only receive live location!
            if (targetPlayer && targetPlayer.role === player.role) {
              targetSock.emit(SOCKET_EVENTS.LOCATION_UPDATE, newLocation);
            }
          }
        }
      }
    } catch (err: any) {
      logger.error('Error handling location:update:', err);
    }
  });
}
