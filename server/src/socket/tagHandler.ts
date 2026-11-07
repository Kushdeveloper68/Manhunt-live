import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { AuthenticatedSocket } from './auth.js';
import { gameStateStore } from '../game/gameStateStore.js';
import { gameLoopManager } from '../game/gameLoop.js';
import { filterStateForPlayer } from '../game/visibility.js';
import { haversineDistance } from '../game/math.js';
import { Game } from '../models/Game.js';
import { GameEvent } from '../models/GameEvent.js';
import { logger } from '../logger.js';

export interface PendingTagAttempt {
  attemptId: string;
  gameId: string;
  chaserUserId: string;
  chaserUsername: string;
  runnerUserId: string;
  runnerUsername: string;
  createdAt: number;
  expiresAt: number;
  timer: NodeJS.Timeout;
}

// In-memory store for active tag verification timers
export const pendingTagAttempts = new Map<string, PendingTagAttempt>();

/**
 * Executes elimination logic after confirmation or 45s auto-confirm timeout
 */
export async function executeConfirmTag(
  io: Server,
  gameId: string,
  runnerUserId: string,
  chaserUserId: string,
  isAutoConfirm = false
) {
  // Clear any existing pending attempt for this runner/game
  for (const [id, attempt] of pendingTagAttempts.entries()) {
    if (attempt.gameId === gameId && attempt.runnerUserId === runnerUserId) {
      clearTimeout(attempt.timer);
      pendingTagAttempts.delete(id);
    }
  }

  const state = await gameStateStore.get(gameId);
  if (!state || state.status !== 'running') return;

  const runner = state.players.find((p) => p.userId === runnerUserId);
  const chaser = state.players.find((p) => p.userId === chaserUserId);
  if (!runner || runner.status === 'ELIMINATED') return;

  const now = Date.now();
  runner.status = 'ELIMINATED';
  runner.taggedAt = now;
  runner.taggedBy = chaser?.username || 'UNKNOWN CHASER';

  await gameStateStore.set(gameId, state);

  // Persist elimination in MongoDB if valid ObjectId
  if (mongoose.isValidObjectId(gameId) && mongoose.isValidObjectId(runnerUserId)) {
    await Game.updateOne(
      { _id: gameId, 'players.userId': runnerUserId },
      { $set: { 'players.$.status': 'ELIMINATED' } }
    ).catch((err) => logger.error('Failed to update player status in DB:', err));
  }

  // Log GameEvent if valid ObjectId
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

  // Broadcast PLAYER_TAGGED
  io.to(roomName).emit(SOCKET_EVENTS.PLAYER_TAGGED, {
    gameId,
    runnerUserId,
    runnerUsername: runner.username,
    chaserUserId,
    chaserUsername: chaser?.username,
    timestamp: now,
    isAutoConfirm,
  });

  // Broadcast PLAYER_ELIMINATED
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
        const filtered = filterStateForPlayer(state, sock.data.user.userId);
        sock.emit(SOCKET_EVENTS.GAME_STATE, filtered);
      }
    }
  }

  logger.info(
    `Tag confirmed: Runner ${runner.username} eliminated by ${chaser?.username || chaserUserId} in game ${state.code} (auto: ${isAutoConfirm})`
  );

  // Check win condition
  if (remainingRunners === 0) {
    await gameLoopManager.endGame(state, 'CHASER', 'ELIMINATION: All runners have been eliminated');
  }
}

export function registerTagHandlers(io: Server, socket: AuthenticatedSocket) {
  const user = socket.data.user;
  if (!user) return;

  /**
   * TAG_ATTEMPT: Chaser initiates a tag attempt via 4-digit runner PIN or proximity target
   */
  socket.on(SOCKET_EVENTS.TAG_ATTEMPT, async (data: {
    gameId: string;
    runnerCode?: string;
    targetUserId?: string;
  }) => {
    try {
      const { gameId, runnerCode, targetUserId } = data;
      if (!gameId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'gameId is required' });
        return;
      }

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

      // Find runner by code or targetUserId
      let targetRunner = null;
      if (runnerCode) {
        const cleanCode = runnerCode.trim();
        for (const [runnerId, code] of state.tagCodes.entries()) {
          if (code === cleanCode) {
            targetRunner = state.players.find(
              (p) => p.userId === runnerId && p.role === 'RUNNER' && p.status === 'ACTIVE'
            );
            if (targetRunner) break;
          }
        }
      } else if (targetUserId) {
        targetRunner = state.players.find(
          (p) => p.userId === targetUserId && p.role === 'RUNNER' && p.status === 'ACTIVE'
        );
      }

      if (!targetRunner) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Runner not found, code incorrect, or runner already eliminated',
        });
        return;
      }

      // Proximity verification if locations available
      const chaserLoc = state.locations.get(caller.userId)?.coordinates;
      const runnerLoc = state.locations.get(targetRunner.userId)?.coordinates;
      let distanceMeters = 0;
      if (chaserLoc && runnerLoc) {
        distanceMeters = Math.round(haversineDistance(chaserLoc, runnerLoc));
        // If distance exceeds 100m, reject
        if (distanceMeters > 100) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: `Target is too far (${distanceMeters}m). Must be within proximity range.`,
          });
          return;
        }
      }

      const attemptId = `tag_${caller.userId}_${targetRunner.userId}_${Date.now()}`;
      const expiresAt = Date.now() + 45000;

      // 45s Auto-confirm timer
      const timer = setTimeout(async () => {
        logger.info(`Tag attempt ${attemptId} timed out -> auto-confirming elimination`);
        await executeConfirmTag(io, gameId, targetRunner.userId, caller.userId, true);
      }, 45000);
      if (timer.unref) timer.unref();

      const attempt: PendingTagAttempt = {
        attemptId,
        gameId,
        chaserUserId: caller.userId,
        chaserUsername: caller.username,
        runnerUserId: targetRunner.userId,
        runnerUsername: targetRunner.username,
        createdAt: Date.now(),
        expiresAt,
        timer,
      };

      pendingTagAttempts.set(attemptId, attempt);

      // Send TAG_ATTEMPT verification prompt to the specific target runner
      const roomSockets = io.sockets.adapter.rooms.get(`game:${gameId}`);
      if (roomSockets) {
        for (const sockId of roomSockets) {
          const s = io.sockets.sockets.get(sockId) as any;
          if (s && s.data?.user?.userId === targetRunner.userId) {
            s.emit(SOCKET_EVENTS.TAG_ATTEMPT, {
              attemptId,
              gameId,
              chaserUserId: caller.userId,
              chaserUsername: caller.username,
              distanceMeters,
              timeoutSec: 45,
              expiresAt,
            });
          }
        }
      }

      // Notify initiating chaser
      socket.emit('tag:attempt_sent', {
        success: true,
        attemptId,
        targetUsername: targetRunner.username,
        expiresAt,
        message: `Tag request sent to @${targetRunner.username}. 45s countdown initiated.`,
      });
    } catch (err) {
      logger.error('Error in TAG_ATTEMPT handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Internal server error processing tag' });
    }
  });

  /**
   * TAG_CONFIRM: Runner confirms they were tagged
   */
  socket.on(SOCKET_EVENTS.TAG_CONFIRM, async (data: {
    gameId: string;
    attemptId?: string;
    chaserUserId?: string;
  }) => {
    try {
      const { gameId, attemptId, chaserUserId } = data;
      if (!gameId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'gameId is required' });
        return;
      }

      let chaserId = chaserUserId;
      if (attemptId && pendingTagAttempts.has(attemptId)) {
        const attempt = pendingTagAttempts.get(attemptId)!;
        chaserId = attempt.chaserUserId;
      }

      if (!chaserId) {
        // Fallback: look up any pending attempt for this runner in this game
        for (const [, attempt] of pendingTagAttempts.entries()) {
          if (attempt.gameId === gameId && attempt.runnerUserId === user.userId) {
            chaserId = attempt.chaserUserId;
            break;
          }
        }
      }

      if (!chaserId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'No active tag attempt found to confirm' });
        return;
      }

      await executeConfirmTag(io, gameId, user.userId, chaserId, false);
    } catch (err) {
      logger.error('Error in TAG_CONFIRM handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Internal server error confirming tag' });
    }
  });

  /**
   * TAG_DISPUTE: Runner disputes the tag
   */
  socket.on(SOCKET_EVENTS.TAG_DISPUTE, async (data: {
    gameId: string;
    attemptId?: string;
    reason?: string;
  }) => {
    try {
      const { gameId, attemptId, reason } = data;
      if (!gameId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'gameId is required' });
        return;
      }

      let chaserUserId = '';
      if (attemptId && pendingTagAttempts.has(attemptId)) {
        const attempt = pendingTagAttempts.get(attemptId)!;
        chaserUserId = attempt.chaserUserId;
        clearTimeout(attempt.timer);
        pendingTagAttempts.delete(attemptId);
      } else {
        // Clean any attempt for this runner
        for (const [id, attempt] of pendingTagAttempts.entries()) {
          if (attempt.gameId === gameId && attempt.runnerUserId === user.userId) {
            chaserUserId = attempt.chaserUserId;
            clearTimeout(attempt.timer);
            pendingTagAttempts.delete(id);
          }
        }
      }

      // Log dispute GameEvent if valid ObjectId
      if (mongoose.isValidObjectId(gameId)) {
        await GameEvent.create({
          gameId,
          type: 'TAG_DISPUTE',
          ts: new Date(),
          payload: {
            action: 'DISPUTE',
            runnerUserId: user.userId,
            runnerUsername: user.username,
            chaserUserId,
            reason: reason || 'Runner disputed tag proximity / false contact',
          },
        }).catch(() => {});
      }

      // Notify the room and specifically the chaser
      io.to(`game:${gameId}`).emit(SOCKET_EVENTS.TAG_DISPUTE, {
        gameId,
        runnerUserId: user.userId,
        runnerUsername: user.username,
        chaserUserId,
        reason: reason || 'Proximity disputed by runner',
      });

      logger.info(
        `Tag disputed by Runner ${user.username} (chaser: ${chaserUserId}) in game ${gameId}`
      );
    } catch (err) {
      logger.error('Error in TAG_DISPUTE handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Internal server error disputing tag' });
    }
  });
}
