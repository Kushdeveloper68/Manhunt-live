import {
  GameSettings,
  GameStatus,
  GamePlayer,
  LivePlayerLocation,
  RunnerSnapshot,
  ZoneSettings,
} from '@manhunt/shared';

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
