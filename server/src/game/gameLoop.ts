import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { SOCKET_EVENTS, RunnerSnapshot } from '@manhunt/shared';
import { gameStateStore, LiveGameState } from './gameStateStore.js';
import { filterStateForPlayer } from './visibility.js';
import {
  isInsideZone,
  distanceOutsideZone,
  shrinkZone,
  nextRevealTimestamp,
} from './math.js';
import { checkNoGoZoneBreach, evaluateOutOfZonePenalty } from './safety.js';
import { clearTagStateForGame } from './tagAttempts.js';
import { emitToUser } from '../socket/emit.js';
import { Game } from '../models/Game.js';
import { GameEvent } from '../models/GameEvent.js';
import { logger } from '../logger.js';

/** Ended games stay in memory this long so late clients can still fetch the result. */
const ENDED_GAME_RETENTION_MS = 10 * 60 * 1000;

class GameLoopManager {
  private io: Server | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private ticking = false;

  init(io: Server) {
    this.io = io;
    if (!this.intervalId) {
      this.intervalId = setInterval(() => void this.tick(), 1000);
      if (this.intervalId.unref) {
        this.intervalId.unref();
      }
      logger.info('GameLoopManager initialized (1Hz tick)');
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Initializes live game state when host launches match
   */
  async startGame(gameId: string, initialGame: any): Promise<LiveGameState> {
    const now = Date.now();
    const headStartMs = (initialGame.settings.headStartMin || 3) * 60 * 1000;
    const revealIntervalMs = (initialGame.settings.revealIntervalMin || 2) * 60 * 1000;
    const shrinkStartMs = (initialGame.settings.zoneShrink?.startAfterMin || 30) * 60 * 1000;

    const liveState: LiveGameState = {
      gameId,
      code: initialGame.code,
      name: initialGame.name,
      hostId: initialGame.hostId._id ? initialGame.hostId._id.toString() : initialGame.hostId.toString(),
      status: 'countdown',
      settings: initialGame.settings,
      players: initialGame.players.map((p: any) => {
        const u = p.userId;
        const uid = u._id ? u._id.toString() : u.toString();
        return {
          userId: uid,
          username: u.username || 'OPERATIVE',
          avatarId: u.avatarId || 'wolf',
          role: p.role,
          status: p.status || 'ACTIVE',
          ready: p.ready ?? true,
          isHost: uid === (initialGame.hostId._id ? initialGame.hostId._id.toString() : initialGame.hostId.toString()),
        };
      }),
      startedAt: now,
      headStartEndsAt: now + headStartMs,
      nextRevealAt: now + headStartMs + revealIntervalMs,
      nextShrinkAt: now + shrinkStartMs,
      shrinkStage: 0,
      currentZone: initialGame.settings.zone,
      locations: new Map(),
      runnerSnapshots: [],
      tagCodes: new Map(),
      breachStartedAt: new Map(),
      permanentReveal: new Set(),
    };

    // Assign a 4-digit code to each runner
    liveState.players.forEach((p) => {
      if (p.role === 'RUNNER') {
        const code = String(Math.floor(1000 + Math.random() * 9000));
        liveState.tagCodes.set(p.userId, code);
      }
    });

    await gameStateStore.set(gameId, liveState);
    return liveState;
  }

  /**
   * 1 Hz loop. Never lets one failing game (or a DB hiccup) crash the process,
   * and never lets two ticks overlap.
   */
  private async tick() {
    if (!this.io || this.ticking) return;
    this.ticking = true;
    try {
      const now = Date.now();
      const games = await gameStateStore.listActive();
      for (const state of games) {
        if (state.status === 'ended') continue;
        try {
          await this.processGame(state, now);
        } catch (err) {
          logger.error(`Game loop error in game ${state.code}:`, err);
        }
      }
    } catch (err) {
      logger.error('Game loop tick failed:', err);
    } finally {
      this.ticking = false;
    }
  }

  private async processGame(state: LiveGameState, now: number) {
    if (!this.io) return;
    const roomName = `game:${state.gameId}`;

    // 1. Countdown (head-start) -> running transition
    if (state.status === 'countdown') {
      const remainingHeadStart = Math.max(0, (state.headStartEndsAt || 0) - now);
      this.io.to(roomName).emit(SOCKET_EVENTS.COUNTDOWN_TICK, {
        gameId: state.gameId,
        remainingMs: remainingHeadStart,
        status: 'countdown',
      });

      if (remainingHeadStart <= 0) {
        state.status = 'running';
        await gameStateStore.set(state.gameId, state);
        await Game.findByIdAndUpdate(state.gameId, { status: 'running' }).catch(() => {});
        logger.info(`Game ${state.code} transitioned to running`);
      }
    }

    if (state.status !== 'running') return;

    // 2. Match duration end
    const durationMs = state.settings.durationMin * 60 * 1000;
    const gameEndsAt = (state.startedAt || now) + durationMs;
    if (now >= gameEndsAt) {
      await this.endGame(state, 'RUNNER', 'SURVIVED: Match duration ended with active runners');
      return;
    }

    // 3. Win conditions
    const activeRunners = state.players.filter((p) => p.role === 'RUNNER' && p.status === 'ACTIVE');
    if (activeRunners.length === 0) {
      await this.endGame(state, 'CHASER', 'ELIMINATION: All runners have been tagged');
      return;
    }
    const hadChasers = state.players.some((p) => p.role === 'CHASER');
    const activeChasers = state.players.filter((p) => p.role === 'CHASER' && p.status === 'ACTIVE');
    if (hadChasers && activeChasers.length === 0) {
      await this.endGame(state, 'RUNNER', 'ESCAPE: All chasers have been eliminated');
      return;
    }

    // 4. Reveal tick
    if (state.nextRevealAt && now >= state.nextRevealAt) {
      const toSnapshots = (list: typeof activeRunners): RunnerSnapshot[] => {
        const snaps: RunnerSnapshot[] = [];
        for (const p of list) {
          const loc = state.locations.get(p.userId);
          if (loc) {
            snaps.push({ userId: p.userId, username: p.username, coordinates: loc.coordinates, timestamp: now });
          }
        }
        return snaps;
      };

      const newSnapshots = toSnapshots(activeRunners);
      state.runnerSnapshots = newSnapshots;

      const bothWays = state.settings.revealMode === 'BOTH_WAYS';
      const chaserSnapshots = bothWays ? toSnapshots(activeChasers) : undefined;
      if (bothWays) state.chaserSnapshots = chaserSnapshots;

      state.nextRevealAt = nextRevealTimestamp(now, state.settings.revealIntervalMin);
      await gameStateStore.set(state.gameId, state);

      // Chasers receive runner snapshots
      this.broadcastToRole(state, 'CHASER', SOCKET_EVENTS.REVEAL_TICK, {
        gameId: state.gameId,
        snapshots: newSnapshots,
        nextRevealTimestamp: state.nextRevealAt,
      });

      // BOTH_WAYS: runners receive CHASER snapshots (never their own team's)
      if (bothWays) {
        this.broadcastToRole(state, 'RUNNER', SOCKET_EVENTS.REVEAL_TICK, {
          gameId: state.gameId,
          snapshots: [],
          chaserSnapshots,
          nextRevealTimestamp: state.nextRevealAt,
        });
      }

      logger.debug(`Reveal tick fired for game ${state.code}: ${newSnapshots.length} runners pinged`);
    }

    // 5. Zone shrink
    const maxStages = state.settings.zoneShrink.count || 3;
    if (state.shrinkStage < maxStages && state.nextShrinkAt && now >= state.nextShrinkAt) {
      state.shrinkStage += 1;
      state.currentZone = shrinkZone(state.currentZone, state.settings.zoneShrink.percent || 25);
      const shrink = state.settings.zoneShrink;
      const shrinkIntervalMs = (shrink.intervalMin ?? shrink.startAfterMin ?? 30) * 60 * 1000;
      state.nextShrinkAt = now + shrinkIntervalMs;
      await gameStateStore.set(state.gameId, state);

      this.io.to(roomName).emit(SOCKET_EVENTS.ZONE_SHRINKING, {
        gameId: state.gameId,
        stage: state.shrinkStage,
        newRadius: state.currentZone.radius,
      });
      this.io.to(roomName).emit(SOCKET_EVENTS.ZONE_UPDATE, {
        gameId: state.gameId,
        zone: state.currentZone,
      });
    }

    // 6. Zone / no-go breaches + host-chosen penalty
    await this.processZoneBreaches(state, now);
  }

  /**
   * Applies the host's out-of-zone penalty (WARNING / REVEAL / ELIMINATE).
   * Warnings go ONLY to the player who breached - never to the whole room, since
   * "who is outside and how far" would leak a runner's position to chasers.
   */
  async processZoneBreaches(state: LiveGameState, now: number) {
    if (!this.io) return;
    const breach = (state.breachStartedAt ??= new Map());
    const revealed = (state.permanentReveal ??= new Set());
    const noGoZones = state.settings.noGoZones || [];

    for (const player of state.players) {
      if (player.status !== 'ACTIVE') {
        breach.delete(player.userId);
        continue;
      }
      const loc = state.locations.get(player.userId);
      if (!loc) continue;

      const outside = !isInsideZone(loc.coordinates, state.currentZone);
      const noGo = checkNoGoZoneBreach(loc.coordinates, noGoZones);

      if (!outside && !noGo.inViolation) {
        // Back in bounds: tell the player once.
        if (breach.delete(player.userId)) {
          emitToUser(this.io, state.gameId, player.userId, SOCKET_EVENTS.ZONE_VIOLATION, {
            gameId: state.gameId,
            userId: player.userId,
            inViolation: false,
            distanceOutsideMeters: 0,
            penalty: state.settings.outOfZonePenalty,
          });
        }
        continue;
      }

      if (!breach.has(player.userId)) breach.set(player.userId, now);
      const secondsInBreach = Math.floor((now - breach.get(player.userId)!) / 1000);
      const distanceOut = outside ? distanceOutsideZone(loc.coordinates, state.currentZone) : 0;
      const result = evaluateOutOfZonePenalty(
        state.settings.outOfZonePenalty,
        secondsInBreach,
        distanceOut
      );

      emitToUser(this.io, state.gameId, player.userId, SOCKET_EVENTS.ZONE_VIOLATION, {
        gameId: state.gameId,
        userId: player.userId,
        inViolation: true,
        reason: noGo.inViolation && !outside ? 'NO_GO_ZONE' : 'OUT_OF_ZONE',
        zoneName: noGo.zoneName,
        distanceOutsideMeters: Math.round(distanceOut),
        secondsInBreach,
        penalty: state.settings.outOfZonePenalty,
        action: result.action,
        countdownSec: result.countdownSec,
        message: result.message,
      });

      if (result.action === 'REVEAL' && player.role === 'RUNNER' && !revealed.has(player.userId)) {
        revealed.add(player.userId);
        await gameStateStore.set(state.gameId, state);
        logger.info(`Zone penalty: @${player.username} permanently revealed in game ${state.code}`);
        await this.broadcastFilteredState(state);
      }

      if (result.action === 'ELIMINATE') {
        await this.eliminateForBreach(state, player.userId);
      }
    }
  }

  /** Eliminates a player for exceeding the zone-breach grace period. */
  private async eliminateForBreach(state: LiveGameState, userId: string) {
    const player = state.players.find((p) => p.userId === userId);
    if (!player || player.status !== 'ACTIVE') return;

    const now = Date.now();
    player.status = 'ELIMINATED';
    player.taggedAt = now;
    player.taggedBy = 'ZONE BREACH';
    state.breachStartedAt?.delete(userId);
    await gameStateStore.set(state.gameId, state);

    if (mongoose.isValidObjectId(state.gameId) && mongoose.isValidObjectId(userId)) {
      await Game.updateOne(
        { _id: state.gameId, 'players.userId': userId },
        { $set: { 'players.$.status': 'ELIMINATED' } }
      ).catch((err) => logger.error('Failed to persist breach elimination:', err));
      await GameEvent.create({
        gameId: state.gameId,
        type: 'ZONE_ELIMINATION',
        ts: new Date(now),
        payload: { userId, username: player.username, role: player.role },
      }).catch(() => {});
    }

    const remainingRunners = state.players.filter(
      (p) => p.role === 'RUNNER' && p.status === 'ACTIVE'
    ).length;

    this.io?.to(`game:${state.gameId}`).emit(SOCKET_EVENTS.PLAYER_ELIMINATED, {
      gameId: state.gameId,
      runnerUserId: userId, // kept for client compatibility
      userId,
      role: player.role,
      runnerUsername: player.username,
      remainingRunners,
      eliminatedAt: now,
      cause: 'ZONE_BREACH',
    });

    await this.broadcastFilteredState(state);
    logger.info(`@${player.username} eliminated for zone breach in game ${state.code}`);
  }

  /** Re-sends each connected player their own filtered view of the game. */
  async broadcastFilteredState(state: LiveGameState) {
    if (!this.io) return;
    const sockets = this.io.sockets.adapter.rooms.get(`game:${state.gameId}`);
    if (!sockets) return;
    for (const socketId of sockets) {
      const sock = this.io.sockets.sockets.get(socketId) as any;
      if (sock?.data?.user) {
        sock.emit(SOCKET_EVENTS.GAME_STATE, filterStateForPlayer(state, sock.data.user.userId));
      }
    }
  }

  /**
   * Broadcast an event to players of a specific role only
   */
  broadcastToRole(state: LiveGameState, role: string, event: string, payload: any) {
    if (!this.io) return;
    const roomName = `game:${state.gameId}`;
    const sockets = this.io.sockets.adapter.rooms.get(roomName);
    if (!sockets) return;

    for (const socketId of sockets) {
      const sock = this.io.sockets.sockets.get(socketId) as any;
      if (sock && sock.data?.user) {
        const player = state.players.find((p) => p.userId === sock.data.user.userId);
        if (player && player.role === role) {
          sock.emit(event, payload);
        }
      }
    }
  }

  /**
   * Concludes a game match, persists result to DB, broadcasts GAME_END.
   * Idempotent: a second call for an already-ended game is ignored.
   */
  async endGame(state: LiveGameState, winningRole: 'CHASER' | 'RUNNER', reason: string) {
    if (state.status === 'ended') return;
    state.status = 'ended';
    state.endedAt = Date.now();
    state.winnerRole = winningRole;
    state.endReason = reason;

    await gameStateStore.set(state.gameId, state);
    clearTagStateForGame(state.gameId);

    await Game.findByIdAndUpdate(state.gameId, {
      status: 'ended',
      endedAt: new Date(state.endedAt),
      result: { winningRole, reason },
    }).catch(() => {});

    if (this.io) {
      this.io.to(`game:${state.gameId}`).emit(SOCKET_EVENTS.GAME_END, {
        gameId: state.gameId,
        winningRole,
        reason,
        endedAt: state.endedAt,
      });
    }

    // Free memory once clients have had time to read the result.
    const cleanup = setTimeout(() => {
      void gameStateStore.delete(state.gameId);
    }, ENDED_GAME_RETENTION_MS);
    if (cleanup.unref) cleanup.unref();

    logger.info(`Game ${state.code} ended. Winner: ${winningRole}. Reason: ${reason}`);
  }
}

export const gameLoopManager = new GameLoopManager();
