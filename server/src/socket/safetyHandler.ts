import { Server } from 'socket.io';
import { z } from 'zod';
import mongoose from 'mongoose';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { GameEvent } from '../models/GameEvent.js';
import { User } from '../models/User.js';
import { AuthenticatedSocket } from './auth.js';
import { logger } from '../logger.js';

const sosTriggerSchema = z.object({
  gameId: z.string().min(1),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  reason: z.string().optional(),
});

const sosResolvedSchema = z.object({
  gameId: z.string().min(1),
});

export function registerSafetyHandlers(io: Server, socket: AuthenticatedSocket) {
  const user = socket.data.user!;

  // 1. SOS Emergency Trigger
  socket.on(SOCKET_EVENTS.SOS_TRIGGER, async (payload: unknown) => {
    try {
      const data = sosTriggerSchema.parse(payload);
      const now = new Date();

      // Retrieve operative's emergency contact
      let emergencyContact: { name: string; phone: string } | undefined;
      try {
        const userDoc = await User.findById(user.userId).select('emergencyContact');
        if (userDoc?.emergencyContact?.phone) {
          emergencyContact = userDoc.emergencyContact;
        }
      } catch (_err) {
        // Fallback gracefully
      }

      // Persist event to MongoDB audit trail
      await GameEvent.create({
        gameId: new mongoose.Types.ObjectId(data.gameId),
        type: 'SOS_TRIGGER',
        payload: {
          userId: user.userId,
          username: user.username,
          coordinates: data.coordinates,
          reason: data.reason || 'Manual SOS 3s hold trigger',
          emergencyContact,
        },
        ts: now,
      }).catch((err) => {
        logger.error('Failed to log SOS GameEvent:', err);
      });

      const sosPayload = {
        gameId: data.gameId,
        userId: user.userId,
        username: user.username,
        coordinates: data.coordinates,
        timestamp: now.getTime(),
        emergencyContact,
        liveBeaconUrl: `https://grid.manhunt.live/beacon/${data.gameId}/${user.userId}`,
      };

      // Broadcast high-priority SOS emergency to the entire game session (host + teammates + chasers)
      const roomName = `game:${data.gameId}`;
      io.to(roomName).emit(SOCKET_EVENTS.SOS_TRIGGER, sosPayload);

      logger.warn(
        `🚨 [SOS TRIGGERED] Operative @${user.username} activated SOS in game ${data.gameId} at (${data.coordinates.latitude}, ${data.coordinates.longitude})`
      );
    } catch (err: any) {
      logger.error('Error in sos:trigger handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message || 'SOS dispatch failed' });
    }
  });

  // 2. SOS Emergency Resolved / Stand Down
  socket.on(SOCKET_EVENTS.SOS_RESOLVED, async (payload: unknown) => {
    try {
      const data = sosResolvedSchema.parse(payload);
      const now = new Date();

      await GameEvent.create({
        gameId: new mongoose.Types.ObjectId(data.gameId),
        type: 'SOS_RESOLVED',
        payload: {
          userId: user.userId,
          username: user.username,
        },
        ts: now,
      }).catch(() => {});

      const resolvedPayload = {
        gameId: data.gameId,
        userId: user.userId,
        username: user.username,
        timestamp: now.getTime(),
      };

      const roomName = `game:${data.gameId}`;
      io.to(roomName).emit(SOCKET_EVENTS.SOS_RESOLVED, resolvedPayload);

      logger.info(`✅ [SOS RESOLVED] Operative @${user.username} cancelled SOS in game ${data.gameId}`);
    } catch (err: any) {
      logger.error('Error in sos:resolved handler:', err);
    }
  });
}
