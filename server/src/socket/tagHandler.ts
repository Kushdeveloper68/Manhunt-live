import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { z } from 'zod';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { AuthenticatedSocket } from './auth.js';
import { emitToUser } from './emit.js';
import { gameStateStore } from '../game/gameStateStore.js';
import { gameLoopManager } from '../game/gameLoop.js';
import { filterStateForPlayer } from '../game/visibility.js';
import {
  TAG_AUTO_CONFIRM_MS,
  TAG_DISPUTE_COOLDOWN_MS,
  validateTagProximity,
} from '../game/tagRules.js';
import {
  PendingTagAttempt,
  pendingTagAttempts,
  disputeCooldowns,
  tagCodeLimiter,
  findPendingForRunner,
  clearPendingForRunner,
} from '../game/tagAttempts.js';
import { Game } from '../models/Game.js';
import { GameEvent } from '../models/GameEvent.js';
import { logger } from '../logger.js';

// Re-exported so existing imports keep working.
export { pendingTagAttempts };
export type { PendingTagAttempt };

const tagAttemptSchema = z.object({
  gameId: z.string().min(1),
  // The 4-digit code is MANDATORY: it is the proof that the runner was physically reached.
  runnerCode: z.string().regex(/^\d{4}$/, 'Runner code must be exactly 4 digits'),
});

const tagResponseSchema = z.object({
  gameId: z.string().min(1),
  attemptId: z.string().optional(),
  reason: z.string().max(200).optional(),
});

/**
 * Executes elimination logic after confirmation or auto-confirm timeout.
 * Only a RUNNER can be eliminated by a tag.
 */
export async function executeConfirmTag(
  io: Server,
  gameId: string,
  runnerUserId: string,
  chaserUserId: string,
  isAutoConfirm = false
) {
  clearPendingForRunner(gameId, runnerUserId);

  const state = await gameStateStore.get(gameId);
  if (!state || state.status !== 'running') return;

  const runner = state.players.find((p) => p.userId === runnerUserId);
  const chaser = state.players.find((p) => p.userId === chaserUserId);
  if (!runner || runner.role !== 'RUNNER' || runner.status === 'ELIMINATED') return;

  const now = Date.now();
  runner.status = 'ELIMINATED';
  runner.taggedAt = now;
  runner.taggedBy = chaser?.username || 'UNKNOWN CHASER';

  await gameStateStore.set(gameId, state);

  if (mongoose.isValidObjectId(gameId) && mongoose.isValidObjectId(runnerUserId)) {
    await Game.updateOne(
      { _id: gameId, 'players.userId': runnerUserId },
      { $set: { 'players.$.status': 'ELIMINATED' } }
    ).catch((err) => logger.error('Failed to update player status in DB:', err));
  }

  if (mongoose.isValidObjectId(gameId)) {
    const runnerLoc = state.locations.get(runnerUserId)?.coordinates || state.currentZone.center;
    await GameEvent.create({
      gameId,
      type: 'TAG',
      ts: new Date(now),
      payload: {
        coordinates: runnerLoc,
        chaserUserId,
        chaserUsername: chaser?.username,
        runnerUserId,
        runnerUsername: runner.username,
        isAutoConfirm,
      },
    }).catch((err) => logger.error('Failed to log GameEvent for tag:', err));
  }

  const remainingRunners = state.players.filter(
    (p) => p.role === 'RUNNER' && p.status === 'ACTIVE'
  ).length;

  const roomName = `game:${gameId}`;

  io.to(roomName).emit(SOCKET_EVENTS.PLAYER_TAGGED, {
    gameId,
    runnerUserId,
    runnerUsername: runner.username,
    chaserUserId,
    chaserUsername: chaser?.username,
    timestamp: now,
    isAutoConfirm,
  });

  io.to(roomName).emit(SOCKET_EVENTS.PLAYER_ELIMINATED, {
    gameId,
    runnerUserId,
    runnerUsername: runner.username,
    remainingRunners,
    eliminatedAt: now,
  });

  // Re-broadcast filtered game state to all clients in the room
  const sockets = io.sockets.adapter.rooms.get(roomName);
  if (sockets) {
    for (const socketId of sockets) {
      const sock = io.sockets.sockets.get(socketId) as any;
      if (sock && sock.data?.user) {
        sock.emit(SOCKET_EVENTS.GAME_STATE, filterStateForPlayer(state, sock.data.user.userId));
      }
    }
  }

  logger.info(
    `Tag confirmed: Runner ${runner.username} eliminated by ${chaser?.username || chaserUserId} in game ${state.code} (auto: ${isAutoConfirm})`
  );

  if (remainingRunners === 0) {
    await gameLoopManager.endGame(state, 'CHASER', 'ELIMINATION: All runners have been eliminated');
  }
}

export function registerTagHandlers(io: Server, socket: AuthenticatedSocket) {
  const user = socket.data.user;
  if (!user) return;

  /**
   * TAG_ATTEMPT: a chaser submits the runner's 4-digit code.
   * Valid only if the code matches AND both phones were recently seen within range.
   */
  socket.on(SOCKET_EVENTS.TAG_ATTEMPT, async (payload: unknown) => {
    try {
      const parsed = tagAttemptSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Enter the runner\'s 4-digit code to tag.' });
        return;
      }
      const { gameId, runnerCode } = parsed.data;

      const state = await gameStateStore.get(gameId);
      if (!state || state.status !== 'running') {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Game is not running' });
        return;
      }

      const caller = state.players.find((p) => p.userId === user.userId);
      if (!caller || caller.role !== 'CHASER' || caller.status !== 'ACTIVE') {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only active chasers can initiate tags' });
        return;
      }

      // Brute-force protection: 4-digit codes only have 10,000 combinations.
      const limiterKey = `${gameId}:${caller.userId}`;
      if (tagCodeLimiter.isBlocked(limiterKey)) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Too many wrong codes. Wait a minute before trying again.',
        });
        return;
      }

      let targetRunner = null as (typeof state.players)[number] | null;
      for (const [runnerId, code] of state.tagCodes.entries()) {
        if (code === runnerCode) {
          const candidate = state.players.find(
            (p) => p.userId === runnerId && p.role === 'RUNNER' && p.status === 'ACTIVE'
          );
          if (candidate) {
            targetRunner = candidate;
            break;
          }
        }
      }

      if (!targetRunner) {
        tagCodeLimiter.recordFailure(limiterKey);
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Code incorrect, or that runner is already eliminated',
        });
        return;
      }

      const cooldownKey = `${gameId}:${caller.userId}:${targetRunner.userId}`;
      if ((disputeCooldowns.get(cooldownKey) || 0) > Date.now()) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'This runner disputed your last tag. Wait a moment before retrying.',
        });
        return;
      }

      if (findPendingForRunner(gameId, targetRunner.userId)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'A tag on this runner is already pending.' });
        return;
      }

      // FAIL-CLOSED proximity: missing/stale location or distance > limit => reject.
      // The exact distance is never returned to the chaser (it would leak the runner's position).
      const proximity = validateTagProximity(
        state.locations.get(caller.userId),
        state.locations.get(targetRunner.userId)
      );
      if (!proximity.ok) {
        const msg =
          proximity.reason === 'TOO_FAR'
            ? 'You are too far from the runner. Get closer and try again.'
            : 'Location not confirmed yet. Wait for GPS to update and try again.';
        socket.emit(SOCKET_EVENTS.ERROR, { message: msg });
        return;
      }

      const attemptId = `tag_${caller.userId}_${targetRunner.userId}_${Date.now()}`;
      const expiresAt = Date.now() + TAG_AUTO_CONFIRM_MS;
      const runnerId = targetRunner.userId;
      const chaserId = caller.userId;

      // Auto-confirm only exists AFTER code + proximity were verified.
      const timer = setTimeout(async () => {
        try {
          logger.info(`Tag attempt ${attemptId} timed out -> auto-confirming elimination`);
          await executeConfirmTag(io, gameId, runnerId, chaserId, true);
        } catch (err) {
          logger.error('Auto-confirm tag failed:', err);
        }
      }, TAG_AUTO_CONFIRM_MS);
      if (timer.unref) timer.unref();

      pendingTagAttempts.set(attemptId, {
        attemptId,
        gameId,
        chaserUserId: chaserId,
        chaserUsername: caller.username,
        runnerUserId: runnerId,
        runnerUsername: targetRunner.username,
        createdAt: Date.now(),
        expiresAt,
        timer,
      });
      tagCodeLimiter.reset(limiterKey);

      // Prompt ONLY the targeted runner.
      emitToUser(io, gameId, runnerId, SOCKET_EVENTS.TAG_ATTEMPT, {
        attemptId,
        gameId,
        chaserUserId: chaserId,
        chaserUsername: caller.username,
        distanceMeters: proximity.distanceMeters,
        timeoutSec: Math.round(TAG_AUTO_CONFIRM_MS / 1000),
        expiresAt,
      });

      socket.emit('tag:attempt_sent', {
        success: true,
        attemptId,
        targetUsername: targetRunner.username,
        expiresAt,
        message: `Tag request sent to @${targetRunner.username}. Waiting for confirmation.`,
      });
    } catch (err) {
      logger.error('Error in TAG_ATTEMPT handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Internal server error processing tag' });
    }
  });

  /**
   * TAG_CONFIRM: the targeted runner confirms they were tagged.
   * The chaser identity always comes from the server-side attempt, never from the client.
   */
  socket.on(SOCKET_EVENTS.TAG_CONFIRM, async (payload: unknown) => {
    try {
      const parsed = tagResponseSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'gameId is required' });
        return;
      }
      const { gameId, attemptId } = parsed.data;

      const attempt =
        (attemptId ? pendingTagAttempts.get(attemptId) : undefined) ??
        findPendingForRunner(gameId, user.userId);

      if (!attempt || attempt.gameId !== gameId || attempt.runnerUserId !== user.userId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'No active tag attempt found to confirm' });
        return;
      }

      await executeConfirmTag(io, gameId, user.userId, attempt.chaserUserId, false);
    } catch (err) {
      logger.error('Error in TAG_CONFIRM handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Internal server error confirming tag' });
    }
  });

  /**
   * TAG_DISPUTE: only the targeted runner can dispute; cancels the attempt and
   * starts a cooldown for that chaser/runner pair.
   */
  socket.on(SOCKET_EVENTS.TAG_DISPUTE, async (payload: unknown) => {
    try {
      const parsed = tagResponseSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'gameId is required' });
        return;
      }
      const { gameId, attemptId, reason } = parsed.data;

      const attempt =
        (attemptId ? pendingTagAttempts.get(attemptId) : undefined) ??
        findPendingForRunner(gameId, user.userId);

      if (!attempt || attempt.gameId !== gameId || attempt.runnerUserId !== user.userId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'No active tag attempt found to dispute' });
        return;
      }

      clearTimeout(attempt.timer);
      pendingTagAttempts.delete(attempt.attemptId);
      disputeCooldowns.set(
        `${gameId}:${attempt.chaserUserId}:${attempt.runnerUserId}`,
        Date.now() + TAG_DISPUTE_COOLDOWN_MS
      );

      const disputeReason = reason || 'Runner disputed the tag';

      if (mongoose.isValidObjectId(gameId)) {
        await GameEvent.create({
          gameId,
          type: 'TAG_DISPUTE',
          ts: new Date(),
          payload: {
            action: 'DISPUTE',
            runnerUserId: user.userId,
            runnerUsername: user.username,
            chaserUserId: attempt.chaserUserId,
            reason: disputeReason,
          },
        }).catch(() => {});
      }

      const disputePayload = {
        gameId,
        runnerUserId: user.userId,
        runnerUsername: user.username,
        chaserUserId: attempt.chaserUserId,
        reason: disputeReason,
      };
      // Only the two people involved are told.
      emitToUser(io, gameId, attempt.chaserUserId, SOCKET_EVENTS.TAG_DISPUTE, disputePayload);
      socket.emit(SOCKET_EVENTS.TAG_DISPUTE, disputePayload);

      logger.info(`Tag disputed by Runner ${user.username} (chaser: ${attempt.chaserUserId}) in game ${gameId}`);
    } catch (err) {
      logger.error('Error in TAG_DISPUTE handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Internal server error disputing tag' });
    }
  });
}
