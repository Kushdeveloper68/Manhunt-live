import {
  GameSettings,
  GameStatus,
  GamePlayer,
  LivePlayerLocation,
  RunnerSnapshot,
  ZoneSettings,
} from '@manhunt/shared';

import type { MatchSummary } from './matchSummary.js';

export interface LiveGameState {
  gameId: string;
  code: string;
  name: string;
  hostId: string;
  status: GameStatus;
  settings: GameSettings;
  players: GamePlayer[];
  startedAt?: number;
  endedAt?: number;
  headStartEndsAt?: number;
  nextRevealAt?: number;
  nextShrinkAt?: number;
  shrinkStage: number;
  currentZone: ZoneSettings;
  locations: Map<string, LivePlayerLocation>;
  runnerSnapshots: RunnerSnapshot[];
  tagCodes: Map<string, string>;
  chaserSnapshots?: RunnerSnapshot[];
  breachStartedAt?: Map<string, number>; // userId -> when current zone breach began
  permanentReveal?: Set<string>; // runners whose live location is exposed to chasers (zone penalty)
  distanceMeters?: Map<string, number>; // distance each player has covered (for km stats)
  shrinkWarnedStage?: number; // last shrink stage a push warning was sent for
  revealWarnedFor?: number; // nextRevealAt value a push warning was sent for
  summary?: MatchSummary;
  activeSos?: Set<string>; // players with an SOS currently active
  winnerRole?: 'CHASER' | 'RUNNER';
  endReason?: string;
}

export interface IGameStateStore {
  get(gameId: string): Promise<LiveGameState | null>;
  set(gameId: string, state: LiveGameState): Promise<void>;
  delete(gameId: string): Promise<void>;
  listActive(): Promise<LiveGameState[]>;
}

export class MemoryGameStateStore implements IGameStateStore {
  private games = new Map<string, LiveGameState>();

  async get(gameId: string): Promise<LiveGameState | null> {
    const game = this.games.get(gameId);
    return game || null;
  }

  async set(gameId: string, state: LiveGameState): Promise<void> {
    this.games.set(gameId, state);
  }

  async delete(gameId: string): Promise<void> {
    this.games.delete(gameId);
  }

  async listActive(): Promise<LiveGameState[]> {
    return Array.from(this.games.values());
  }
}

export const gameStateStore = new MemoryGameStateStore();
