import { Server } from 'socket.io';
import { z } from 'zod';
import { SOCKET_EVENTS, LivePlayerLocation } from '@manhunt/shared';
import { gameStateStore } from '../game/gameStateStore.js';
import { isImpossibleSpeedJump, haversineDistance } from '../game/math.js';
import { plausibleStepMeters } from '../game/matchSummary.js';
import { canReceiveLiveLocation } from '../game/visibility.js';
import { emitToUser } from './emit.js';
import { judgeLocation } from '../game/antiCheat.js';
import { gameLoopManager } from '../game/gameLoop.js';
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

  // Don't keep rate-limit entries for users who left
  socket.on('disconnect', () => {
    for (const key of lastUpdateMap.keys()) if (key.endsWith(`:${user.userId}`)) lastUpdateMap.delete(key);
  });

  socket.on(SOCKET_EVENTS.LOCATION_UPDATE, async (payload: unknown) => {
    try {
      // 1. Validate payload
      const data = locationUpdateSchema.parse(payload);

      // 2. Rate limiting (per player per game): max 1 update every 900 ms
      const now = Date.now();
      const rateKey = `${data.gameId}:${user.userId}`;
      if (now - (lastUpdateMap.get(rateKey) || 0) < 900) {
        return; // drop spamming updates
      }
      lastUpdateMap.set(rateKey, now);

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
        receivedAt: now, // trusted server time, used for tag freshness checks
      };

      // 3. Fair play: fake GPS and teleporting fixes are rejected, repeat offenders removed
      const prevLocation = state.locations.get(user.userId);
      const fairPlay = (state.fairPlay ??= new Map());
      const verdict = judgeLocation(prevLocation, newLocation, fairPlay.get(user.userId) ?? { mock: 0, jumps: 0 }, now);
      fairPlay.set(user.userId, verdict.record);

      if (!verdict.accept) {
        logger.warn(`[FAIR-PLAY] ${verdict.kind} from @${player.username} in game ${state.code} (strikes: ${JSON.stringify(verdict.record)})`);
        if (verdict.warn) {
          socket.emit(SOCKET_EVENTS.FAIR_PLAY_WARNING, {
            kind: verdict.kind,
            message:
              verdict.kind === 'MOCK_GPS'
                ? 'Fake GPS detected. Turn off mock locations or you will be removed from the match.'
                : 'Your position is jumping impossibly fast. Move on foot, or you will be removed from the match.',
          });
        }
        if (verdict.remove) {
          if (state.hostId !== user.userId) {
            emitToUser(io, data.gameId, state.hostId, SOCKET_EVENTS.FAIR_PLAY_ALERT, {
              userId: user.userId,
              username: player.username,
              kind: verdict.kind,
            });
          }
          await gameLoopManager.eliminatePlayer(state, user.userId, 'CHEATING');
        } else {
          await gameStateStore.set(data.gameId, state);
        }
        return; // never use a rejected fix
      }

      // Distance covered (for km stats): only plausible steps count
      if (prevLocation && state.status === 'running') {
        const step = plausibleStepMeters(
          haversineDistance(prevLocation.coordinates, newLocation.coordinates),
          now - (prevLocation.receivedAt ?? prevLocation.timestamp),
          newLocation.isMock,
          newLocation.accuracy
        );
        if (step > 0) {
          const dist = (state.distanceMeters ??= new Map());
          dist.set(user.userId, (dist.get(user.userId) ?? 0) + step);
        }
      }

      // 4. Update GameStateStore
      state.locations.set(user.userId, newLocation);
      await gameStateStore.set(data.gameId, state);

      // While a player's SOS is active, stream their live position to the HOST only
      if (state.activeSos?.has(user.userId) && state.hostId !== user.userId) {
        emitToUser(io, data.gameId, state.hostId, SOCKET_EVENTS.SOS_LOCATION, {
          userId: user.userId,
          username: player.username,
          coordinates: newLocation.coordinates,
          timestamp: now,
        });
      }

      // 5. Visibility delivery: Send live location ONLY to teammates
      const roomName = `game:${data.gameId}`;
      const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
      if (socketsInRoom) {
        for (const sockId of socketsInRoom) {
          const targetSock = io.sockets.sockets.get(sockId) as AuthenticatedSocket;
          if (targetSock && targetSock.data?.user) {
            const recipientId = targetSock.data.user.userId;

            // Single source of truth for who may see a live location (teammates,
            // eliminated spectators, and zone-penalty reveals).
            if (canReceiveLiveLocation(state, user.userId, recipientId)) {
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
