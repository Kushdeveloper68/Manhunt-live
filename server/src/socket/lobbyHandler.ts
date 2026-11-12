import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { z } from 'zod';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { Game } from '../models/Game.js';
import { User } from '../models/User.js';
import { formatGameState } from '../utils/gameState.js';
import { gameLoopManager } from '../game/gameLoop.js';
import { gameStateStore } from '../game/gameStateStore.js';
import { GameInvite } from '../models/GameInvite.js';
import { userRoom } from './presence.js';
import { AuthenticatedSocket } from './auth.js';
import { logger } from '../logger.js';

const joinGameSchema = z.object({
  gameId: z.string().optional(),
  code: z.string().optional(),
}).refine(data => data.gameId || data.code, {
  message: 'Either gameId or code must be provided',
});

const roleAssignSchema = z.object({
  gameId: z.string().min(1),
  targetUserId: z.string().min(1),
  role: z.enum(['CHASER', 'RUNNER', 'UNASSIGNED']),
});

const readySchema = z.object({
  gameId: z.string().min(1),
  ready: z.boolean(),
});

const kickSchema = z.object({
  gameId: z.string().min(1),
  targetUserId: z.string().min(1),
});

const addPlayerSchema = z.object({
  gameId: z.string().min(1),
  username: z.string().min(2).max(20),
});

const gameActionSchema = z.object({
  gameId: z.string().min(1),
});

export function registerLobbyHandlers(io: Server, socket: AuthenticatedSocket) {
  const user = socket.data.user!;

  // 1. Join Game / Lobby
  socket.on(SOCKET_EVENTS.GAME_JOIN, async (payload: unknown) => {
    try {
      const { gameId, code } = joinGameSchema.parse(payload);
      let query: any = {};
      if (gameId) {
        query._id = gameId;
      } else if (code) {
        query.code = code.trim().toUpperCase();
      }

      const game = await Game.findOne(query);
      if (!game) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Tactical session not found' });
      }

      const userObjectId = new mongoose.Types.ObjectId(user.userId);
      const playerIndex = game.players.findIndex(
        (p) => p.userId.toString() === user.userId
      );

      if (playerIndex === -1) {
        // Only allow joining if game is in lobby status
        if (game.status !== 'lobby') {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot join active or ended game' });
        }

        game.players.push({
          userId: userObjectId,
          role: 'UNASSIGNED',
          status: 'ACTIVE',
          ready: false,
        });
        await game.save();
      } else {
        // Player reconnecting: restore active status
        if (game.players[playerIndex].status === 'DISCONNECTED') {
          game.players[playerIndex].status = 'ACTIVE';
          await game.save();
        }
      }

      const populatedGame = await Game.findById(game._id)
        .populate('hostId', 'username avatarId')
        .populate('players.userId', 'username avatarId stats');

      if (!populatedGame) return;

      const roomName = `game:${game._id.toString()}`;
      socket.join(roomName);

      const state = formatGameState(populatedGame);

      // Emit full state sync to joining user
      socket.emit(SOCKET_EVENTS.GAME_STATE, state);

      // Broadcast update to entire lobby room
      io.to(roomName).emit(SOCKET_EVENTS.LOBBY_UPDATE, state);

      logger.debug(`User ${user.username} joined lobby ${game.code}`);
    } catch (err: any) {
      logger.error('Error in game:join handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message || 'Failed to join game' });
    }
  });

  // 2. Leave Game / Lobby
  socket.on(SOCKET_EVENTS.GAME_LEAVE, async (payload: unknown) => {
    try {
      const { gameId } = gameActionSchema.parse(payload);

      // A match is already running: leaving means dropping out of it (otherwise the
      // player stays ACTIVE forever and the match can never end).
      const live = await gameStateStore.get(gameId);
      if (live && live.status !== 'ended') {
        socket.leave(`game:${gameId}`);
        await gameLoopManager.eliminatePlayer(live, user.userId, 'LEFT_GAME');
        return;
      }

      const game = await Game.findById(gameId);
      if (!game) return;

      const roomName = `game:${game._id.toString()}`;
      socket.leave(roomName);

      if (game.status === 'lobby') {
        const isHost = game.hostId.toString() === user.userId;
        if (!isHost) {
          game.players = game.players.filter(
            (p) => p.userId.toString() !== user.userId
          );
          await game.save();

          const populated = await Game.findById(game._id)
            .populate('hostId', 'username avatarId')
            .populate('players.userId', 'username avatarId stats');

          if (populated) {
            io.to(roomName).emit(SOCKET_EVENTS.LOBBY_UPDATE, formatGameState(populated));
          }
        }
      }
    } catch (err: any) {
      logger.error('Error in game:leave handler:', err);
    }
  });

  // 2b. Host cancels the match (lobby or running)
  socket.on(SOCKET_EVENTS.GAME_CANCEL, async (payload: unknown) => {
    try {
      const { gameId } = gameActionSchema.parse(payload);
      const dropInvites = () =>
        mongoose.isValidObjectId(gameId) ? GameInvite.deleteMany({ gameId }).catch(() => {}) : Promise.resolve();

      const live = await gameStateStore.get(gameId);
      if (live && live.status !== 'ended') {
        if (live.hostId !== user.userId) {
          return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only the host can cancel the match' });
        }
        await gameLoopManager.cancelGame(live, 'The host cancelled the match');
        await dropInvites();
        return;
      }

      const game = await Game.findById(gameId);
      if (!game || game.status !== 'lobby') return;
      if (game.hostId.toString() !== user.userId) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only the host can cancel the lobby' });
      }
      game.status = 'ended';
      game.endedAt = new Date();
      game.statsApplied = true;
      await game.save();

      const room = `game:${game._id.toString()}`;
      io.to(room).emit(SOCKET_EVENTS.GAME_CANCELLED, {
        gameId: game._id.toString(),
        reason: 'The host closed the lobby',
      });
      io.in(room).socketsLeave(room);
      await dropInvites();
    } catch (err: any) {
      logger.error('Error in game:cancel handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message || 'Cancel failed' });
    }
  });

  // 3. Assign / Change Role
  socket.on(SOCKET_EVENTS.ROLE_ASSIGN, async (payload: unknown) => {
    try {
      const { gameId, targetUserId, role } = roleAssignSchema.parse(payload);
      const game = await Game.findById(gameId);
      if (!game) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Game session not found' });
      }

      if (game.status !== 'lobby') {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Cannot change roles after match launch' });
      }

      const isHost = game.hostId.toString() === user.userId;
      const isSelf = user.userId === targetUserId;

      if (!isHost && !isSelf) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Only host or operative can assign this role',
        });
      }

      const player = game.players.find((p) => p.userId.toString() === targetUserId);
      if (!player) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Operative not in session' });
      }

      player.role = role;
      await game.save();

      const populated = await Game.findById(game._id)
        .populate('hostId', 'username avatarId')
        .populate('players.userId', 'username avatarId stats');

      if (populated) {
        io.to(`game:${game._id.toString()}`).emit(
          SOCKET_EVENTS.LOBBY_UPDATE,
          formatGameState(populated)
        );
      }
    } catch (err: any) {
      logger.error('Error in role:assign handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message || 'Role assignment failed' });
    }
  });

  // 4. Randomize / Auto-Assign Roles
  socket.on(SOCKET_EVENTS.ROLE_RANDOMIZE, async (payload: unknown) => {
    try {
      const { gameId } = gameActionSchema.parse(payload);
      const game = await Game.findById(gameId);
      if (!game) return;

      if (game.hostId.toString() !== user.userId) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only host can auto-assign roles' });
      }

      if (game.players.length < 2) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'At least 2 operatives required to auto-assign' });
      }

      // Shuffle players randomly
      const shuffledIndices = [...Array(game.players.length).keys()].sort(() => Math.random() - 0.5);

      // Distribute evenly: half Chasers, half Runners
      shuffledIndices.forEach((playerIdx, i) => {
        game.players[playerIdx].role = i % 2 === 0 ? 'CHASER' : 'RUNNER';
      });

      await game.save();

      const populated = await Game.findById(game._id)
        .populate('hostId', 'username avatarId')
        .populate('players.userId', 'username avatarId stats');

      if (populated) {
        io.to(`game:${game._id.toString()}`).emit(
          SOCKET_EVENTS.LOBBY_UPDATE,
          formatGameState(populated)
        );
      }
    } catch (err: any) {
      logger.error('Error in role:randomize handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message || 'Auto-assign failed' });
    }
  });

  // 5. Toggle Ready Status
  socket.on(SOCKET_EVENTS.PLAYER_READY, async (payload: unknown) => {
    try {
      const { gameId, ready } = readySchema.parse(payload);
      const game = await Game.findById(gameId);
      if (!game) return;

      const player = game.players.find((p) => p.userId.toString() === user.userId);
      if (!player) return;

      player.ready = ready;
      await game.save();

      const populated = await Game.findById(game._id)
        .populate('hostId', 'username avatarId')
        .populate('players.userId', 'username avatarId stats');

      if (populated) {
        io.to(`game:${game._id.toString()}`).emit(
          SOCKET_EVENTS.LOBBY_UPDATE,
          formatGameState(populated)
        );
      }
    } catch (err: any) {
      logger.error('Error in player:ready handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message || 'Failed to update readiness' });
    }
  });

  // 6. Kick Operative (Host only)
  socket.on(SOCKET_EVENTS.PLAYER_KICK, async (payload: unknown) => {
    try {
      const { gameId, targetUserId } = kickSchema.parse(payload);
      const game = await Game.findById(gameId);
      if (!game) return;

      if (game.hostId.toString() !== user.userId) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only host can kick operatives' });
      }

      if (targetUserId === user.userId) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Host cannot kick themselves' });
      }

      game.players = game.players.filter(
        (p) => p.userId.toString() !== targetUserId
      );
      await game.save();

      const populated = await Game.findById(game._id)
        .populate('hostId', 'username avatarId')
        .populate('players.userId', 'username avatarId stats');

      // Tell the kicked player directly, then take them out of the room
      const kickRoom = `game:${game._id.toString()}`;
      io.to(userRoom(targetUserId)).emit(SOCKET_EVENTS.PLAYER_KICKED, {
        gameId: game._id.toString(),
        reason: 'The host removed you from the lobby',
      });
      io.in(userRoom(targetUserId)).socketsLeave(kickRoom);

      if (populated) {
        io.to(kickRoom).emit(SOCKET_EVENTS.LOBBY_UPDATE, formatGameState(populated));
      }
    } catch (err: any) {
      logger.error('Error in player:kick handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message || 'Kick failed' });
    }
  });

  // 7. Add Operative by Username / Callsign (Host only)
  socket.on(SOCKET_EVENTS.PLAYER_ADD, async (payload: unknown) => {
    try {
      const { gameId, username } = addPlayerSchema.parse(payload);
      const game = await Game.findById(gameId);
      if (!game) return;

      if (game.hostId.toString() !== user.userId) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only host can invite operatives directly' });
      }

      const targetUser = await User.findOne({ username: username.toLowerCase().trim() });
      if (!targetUser) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: `@${username} not found on grid` });
      }

      const alreadyIn = game.players.some(
        (p) => p.userId.toString() === targetUser._id.toString()
      );
      if (alreadyIn) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: `@${username} already in tactical session` });
      }

      game.players.push({
        userId: targetUser._id,
        role: 'UNASSIGNED',
        status: 'ACTIVE',
        ready: false,
      });
      await game.save();

      const populated = await Game.findById(game._id)
        .populate('hostId', 'username avatarId')
        .populate('players.userId', 'username avatarId stats');

      if (populated) {
        io.to(`game:${game._id.toString()}`).emit(
          SOCKET_EVENTS.LOBBY_UPDATE,
          formatGameState(populated)
        );
      }
    } catch (err: any) {
      logger.error('Error in player:add handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message || 'Failed to add operative' });
    }
  });

  // 8. Launch Game / Match Start (Host only with validations)
  socket.on(SOCKET_EVENTS.GAME_START, async (payload: unknown) => {
    try {
      const { gameId } = gameActionSchema.parse(payload);
      const game = await Game.findById(gameId);
      if (!game) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Game session not found' });
      }

      if (game.hostId.toString() !== user.userId) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only the host can launch the match' });
      }

      if (game.status !== 'lobby') {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: 'Match has already commenced' });
      }

      // Check validation rules:
      // Rule 1: Min 1 Chaser
      const chaserCount = game.players.filter((p) => p.role === 'CHASER').length;
      if (chaserCount < 1) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Threshold not met: At least 1 Chaser required',
        });
      }

      // Rule 2: Min 1 Runner
      const runnerCount = game.players.filter((p) => p.role === 'RUNNER').length;
      if (runnerCount < 1) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Threshold not met: At least 1 Runner required',
        });
      }

      // Rule 3: No unassigned operatives
      const unassignedCount = game.players.filter((p) => p.role === 'UNASSIGNED').length;
      if (unassignedCount > 0) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: `Threshold not met: ${unassignedCount} operative(s) still in Standby Pool`,
        });
      }

      // Rule 4: All players must be ready
      const unreadyCount = game.players.filter((p) => !p.ready).length;
      if (unreadyCount > 0) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: `Threshold not met: ${unreadyCount} operative(s) not ready for drop`,
        });
      }

      // Launch countdown phase
      game.status = 'countdown';
      game.startedAt = new Date();
      await game.save();

      const populated = await Game.findById(game._id)
        .populate('hostId', 'username avatarId')
        .populate('players.userId', 'username avatarId stats');

      if (!populated) return;

      // Start live game loop & in-memory state
      await gameLoopManager.startGame(game._id.toString(), populated);

      const state = formatGameState(populated);
      const roomName = `game:${game._id.toString()}`;

      // Broadcast game:start and updated game state
      io.to(roomName).emit(SOCKET_EVENTS.GAME_START, {
        gameId: game._id.toString(),
        startedAt: state.startedAt,
        headStartMin: game.settings.headStartMin,
      });

      io.to(roomName).emit(SOCKET_EVENTS.GAME_STATE, state);

      logger.info(`Match launched for game ${game.code} by host ${user.username}`);
    } catch (err: any) {
      logger.error('Error in game:start handler:', err);
      socket.emit(SOCKET_EVENTS.ERROR, { message: err.message || 'Match launch failed' });
    }
  });
}
