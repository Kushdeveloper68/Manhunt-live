import { Server } from 'socket.io';
import { z } from 'zod';
import mongoose from 'mongoose';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { GameEvent } from '../models/GameEvent.js';
import { AuthenticatedSocket } from './auth.js';
import { emitToUser } from './emit.js';
import { gameStateStore } from '../game/gameStateStore.js';
import { sendPushToUsers } from '../services/push.js';
import { logger } from '../logger.js';

const sosTriggerSchema = z.object({
  gameId: z.string().min(1),
  // Only a fallback: the server's own last known location is preferred.
  coordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
  reason: z.string().max(200).optional(),
});

const sosResolvedSchema = z.object({ gameId: z.string().min(1) });

const SOS_MIN_INTERVAL_MS = 3000;
const lastSosAt = new Map<string, number>();

/**
 * SOS goes to the HOST only (plus the sender's own confirmation). It is never broadcast to
 * the room: chasers must not learn a runner's position, and nobody but the host should see
 * safety information. The emergency contact is reached by the app via the phone's own SMS/call.
 */
export function registerSafetyHandlers(io: Server, socket: AuthenticatedSocket) {
  const user = socket.data.user!;

  socket.on('disconnect', () => {
    for (const key of lastSosAt.keys()) if (key.endsWith(`:${user.userId}`)) lastSosAt.delete(key);
  });

  socket.on(SOCKET_EVENTS.SOS_TRIGGER, async (payload: unknown) => {
    try {
      const parsed = sosTriggerSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid SOS request' });
        return;
      }
      const data = parsed.data;

      const state = await gameStateStore.get(data.gameId);
      const player = state?.players.find((p) => p.userId === user.userId);
      if (!state || state.status === 'ended' || !player) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'SOS is only available inside your active game' });
        return;
      }

      const now = Date.now();
      const rateKey = `${data.gameId}:${user.userId}`;
      if (now - (lastSosAt.get(rateKey) ?? 0) < SOS_MIN_INTERVAL_MS) return;
      lastSosAt.set(rateKey, now);

      // Trust the server's own fix over what the client claims
      const coordinates = state.locations.get(user.userId)?.coordinates ?? data.coordinates ?? null;

      (state.activeSos ??= new Set()).add(user.userId);
      await gameStateStore.set(data.gameId, state);

      const sosId = `sos_${user.userId}_${now}`;
      const sosPayload = {
        sosId,
        gameId: data.gameId,
        userId: user.userId,
        username: user.username,
        coordinates,
        reason: data.reason,
        timestamp: now,
      };

      const senderIsHost = state.hostId === user.userId;
      const delivered = senderIsHost ? 0 : emitToUser(io, data.gameId, state.hostId, SOCKET_EVENTS.SOS_TRIGGER, sosPayload);
      if (!senderIsHost) {
        void sendPushToUsers([state.hostId], {
          title: 'SOS from a player',
          body: `@${user.username} pressed SOS. Open the app to see their location.`,
          data: { type: 'SOS', gameId: data.gameId },
        });
      }

      if (mongoose.isValidObjectId(data.gameId)) {
        await GameEvent.create({
          gameId: data.gameId,
          type: 'SOS_TRIGGER',
          ts: new Date(now),
          payload: { userId: user.userId, username: user.username, coordinates, reason: data.reason },
        }).catch((err) => logger.error('Failed to log SOS GameEvent:', err));
      }

      // Honest confirmation for the sender: what the server actually did
      socket.emit(SOCKET_EVENTS.SOS_ACK, {
        sosId,
        hostNotified: delivered > 0,
        hostPushSent: !senderIsHost,
        senderIsHost,
        hasLocation: coordinates !== null,
      });

      logger.warn(`[SOS] @${user.username} triggered SOS in game ${state.code} (host live: ${delivered > 0})`);
    } catch (err) {
      logger.error('Error in sos:trigger handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'SOS dispatch failed. Call your emergency number directly.' });
    }
  });

  socket.on(SOCKET_EVENTS.SOS_RESOLVED, async (payload: unknown) => {
    try {
      const parsed = sosResolvedSchema.safeParse(payload);
      if (!parsed.success) return;
      const { gameId } = parsed.data;

      const state = await gameStateStore.get(gameId);
      if (!state || !state.players.some((p) => p.userId === user.userId)) return;

      state.activeSos?.delete(user.userId);
      await gameStateStore.set(gameId, state);

      if (state.hostId !== user.userId) {
        emitToUser(io, gameId, state.hostId, SOCKET_EVENTS.SOS_RESOLVED, {
          gameId,
          userId: user.userId,
          username: user.username,
          timestamp: Date.now(),
        });
      }
      if (mongoose.isValidObjectId(gameId)) {
        await GameEvent.create({
          gameId,
          type: 'SOS_RESOLVED',
          ts: new Date(),
          payload: { userId: user.userId, username: user.username },
        }).catch(() => {});
      }
      logger.info(`[SOS RESOLVED] @${user.username} cancelled SOS in game ${state.code}`);
    } catch (err) {
      logger.error('Error in sos:resolved handler:', err);
    }
  });
}
