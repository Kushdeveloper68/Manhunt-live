import { Server } from 'socket.io';
import { SOCKET_EVENTS, RunnerSnapshot } from '@manhunt/shared';
import { gameStateStore, LiveGameState } from './gameStateStore.js';
import { filterStateForPlayer } from './visibility.js';
import {
  isInsideZone,
  distanceOutsideZone,
  shrinkZone,
  nextRevealTimestamp,
} from './math.js';
import { Game } from '../models/Game.js';
import { logger } from '../logger.js';

class GameLoopManager {
  private io: Server | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  init(io: Server) {
    this.io = io;
    if (!this.intervalId) {
      this.intervalId = setInterval(() => this.tick(), 1000);
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

  private async tick() {
    if (!this.io) return;
    const now = Date.now();
    const activeGames = await gameStateStore.listActive();

    for (const state of activeGames) {
      if (state.status === 'ended') continue;

      const roomName = `game:${state.gameId}`;

      // 1. Check countdown -> running transition
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

          // Update MongoDB status
          await Game.findByIdAndUpdate(state.gameId, { status: 'running' }).catch(() => {});
          logger.info(`Game ${state.code} transitioned to running`);
        }
      }

      if (state.status !== 'running') continue;

      // 2. Check Match Duration End
      const durationMs = state.settings.durationMin * 60 * 1000;
      const gameEndsAt = (state.startedAt || now) + durationMs;
      if (now >= gameEndsAt) {
        await this.endGame(state, 'RUNNER', 'SURVIVED: Match duration ended with active runners');
        continue;
      }

      // 3. Check All Runners Tagged Win Condition
      const activeRunners = state.players.filter(
        (p) => p.role === 'RUNNER' && p.status === 'ACTIVE'
      );
      if (activeRunners.length === 0) {
        await this.endGame(state, 'CHASER', 'ELIMINATION: All runners have been tagged');
        continue;
      }

      // 4. Reveal Tick (Snapshot runners to chasers)
      if (state.nextRevealAt && now >= state.nextRevealAt) {
        const newSnapshots: RunnerSnapshot[] = [];
        for (const runner of activeRunners) {
          const loc = state.locations.get(runner.userId);
          if (loc) {
            newSnapshots.push({
              userId: runner.userId,
              username: runner.username,
              coordinates: loc.coordinates,
              timestamp: now,
            });
          }
        }

        state.runnerSnapshots = newSnapshots;
        state.nextRevealAt = nextRevealTimestamp(now, state.settings.revealIntervalMin);
        await gameStateStore.set(state.gameId, state);

        // Broadcast snapshots to chasers only
        this.broadcastToRole(state, 'CHASER', SOCKET_EVENTS.REVEAL_TICK, {
          gameId: state.gameId,
          snapshots: newSnapshots,
          nextRevealTimestamp: state.nextRevealAt,
        });

        logger.debug(`Reveal tick fired for game ${state.code}: ${newSnapshots.length} runners pinged`);
      }

      // 5. Zone Shrink Check
      const maxStages = state.settings.zoneShrink.count || 3;
      if (state.shrinkStage < maxStages && state.nextShrinkAt && now >= state.nextShrinkAt) {
        state.shrinkStage += 1;
        state.currentZone = shrinkZone(
          state.currentZone,
          state.settings.zoneShrink.percent || 25
        );
        const shrinkIntervalMs = (state.settings.zoneShrink.startAfterMin || 30) * 60 * 1000;
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

      // 6. Zone Violation Checks (Haversine)
      for (const player of state.players) {
        if (player.status !== 'ACTIVE') continue;
        const loc = state.locations.get(player.userId);
        if (loc) {
          const inside = isInsideZone(loc.coordinates, state.currentZone);
          if (!inside) {
            const distanceOut = distanceOutsideZone(loc.coordinates, state.currentZone);
            this.io.to(roomName).emit(SOCKET_EVENTS.ZONE_VIOLATION, {
              gameId: state.gameId,
              userId: player.userId,
              username: player.username,
              role: player.role,
              distanceOutsideMeters: Math.round(distanceOut),
              penalty: state.settings.outOfZonePenalty,
            });
          }
        }
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
   * Concludes a game match, persists result to DB, broadcasts GAME_END
   */
  async endGame(state: LiveGameState, winningRole: 'CHASER' | 'RUNNER', reason: string) {
    state.status = 'ended';
    state.endedAt = Date.now();
    state.winnerRole = winningRole;
    state.endReason = reason;

    await gameStateStore.set(state.gameId, state);

    await Game.findByIdAndUpdate(state.gameId, {
      status: 'ended',
      endedAt: new Date(state.endedAt),
      result: {
        winningRole,
        reason,
      },
    }).catch(() => {});

    if (this.io) {
      this.io.to(`game:${state.gameId}`).emit(SOCKET_EVENTS.GAME_END, {
        gameId: state.gameId,
        winningRole,
        reason,
        endedAt: state.endedAt,
      });
    }

    logger.info(`Game ${state.code} ended. Winner: ${winningRole}. Reason: ${reason}`);
  }
}

export const gameLoopManager = new GameLoopManager();
