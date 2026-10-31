import { create } from 'zustand';
import { GameSettings, NoGoZone } from '@manhunt/shared';
import { api, GameResponse } from '../services/api';

export interface CreateGameDraft {
  name: string;
  mode: 'Classic Manhunt' | 'Last Runner Standing';
  maxPlayers: number;
  settings: GameSettings;
}

const DEFAULT_DRAFT: CreateGameDraft = {
  name: 'CENTRAL PARK PURSUIT',
  mode: 'Classic Manhunt',
  maxPlayers: 16,
  settings: {
    zone: {
      center: { latitude: 40.78509, longitude: -73.96828 },
      radius: 1500, // 1.5 km
    },
    noGoZones: [
      {
        id: 'metro-transit',
        name: 'METRO TRANSIT',
        polygon: [
          { latitude: 40.79, longitude: -73.97 },
          { latitude: 40.792, longitude: -73.965 },
          { latitude: 40.788, longitude: -73.96 },
        ],
      },
    ],
    durationMin: 60,
    headStartMin: 3,
    revealIntervalMin: 2,
    revealMode: 'RUNNERS_TO_CHASERS',
    zoneShrink: {
      startAfterMin: 30,
      percent: 25,
      count: 3,
    },
    tagMethod: 'CODE',
    outOfZonePenalty: 'WARNING',
    teamVisibility: 'TEAMMATES_ONLY',
  },
};

interface GameState {
  currentGame: GameResponse | null;
  activeGames: GameResponse[];
  recentGames: GameResponse[];
  draft: CreateGameDraft;
  isLoading: boolean;
  error: string | null;

  setDraftBasics: (name: string, mode: 'Classic Manhunt' | 'Last Runner Standing', maxPlayers: number) => void;
  setDraftZone: (center: { latitude: number; longitude: number }, radius: number) => void;
  addNoGoZone: (noGoZone: NoGoZone) => void;
  removeNoGoZone: (id: string) => void;
  setDraftRules: (rules: Partial<GameSettings>) => void;
  resetDraft: () => void;

  createGameFromDraft: () => Promise<GameResponse>;
  lookupGameByCode: (code: string) => Promise<GameResponse>;
  loadMyGames: () => Promise<void>;
  setCurrentGame: (game: GameResponse | null) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  currentGame: null,
  activeGames: [],
  recentGames: [],
  draft: DEFAULT_DRAFT,
  isLoading: false,
  error: null,

  setDraftBasics: (name, mode, maxPlayers) => {
    set((state) => ({
      draft: { ...state.draft, name, mode, maxPlayers },
    }));
  },

  setDraftZone: (center, radius) => {
    set((state) => ({
      draft: {
        ...state.draft,
        settings: {
          ...state.draft.settings,
          zone: { center, radius },
        },
      },
    }));
  },

  addNoGoZone: (noGoZone) => {
    set((state) => ({
      draft: {
        ...state.draft,
        settings: {
          ...state.draft.settings,
          noGoZones: [...state.draft.settings.noGoZones, noGoZone],
        },
      },
    }));
  },

  removeNoGoZone: (id) => {
    set((state) => ({
      draft: {
        ...state.draft,
        settings: {
          ...state.draft.settings,
          noGoZones: state.draft.settings.noGoZones.filter((z) => z.id !== id),
        },
      },
    }));
  },

  setDraftRules: (rules) => {
    set((state) => ({
      draft: {
        ...state.draft,
        settings: {
          ...state.draft.settings,
          ...rules,
        },
      },
    }));
  },

  resetDraft: () => {
    set({ draft: DEFAULT_DRAFT });
  },

  createGameFromDraft: async () => {
    set({ isLoading: true, error: null });
    try {
      const { draft } = get();
      const res = await api.createGame({
        name: draft.name,
        mode: draft.mode,
        settings: draft.settings,
      });
      set({ currentGame: res.game, isLoading: false });
      return res.game;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create game';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  lookupGameByCode: async (code: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.getGameByCode(code);
      set({ currentGame: res.game, isLoading: false });
      return res.game;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Game not found';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  loadMyGames: async () => {
    try {
      const res = await api.getMyGames();
      set({ activeGames: res.active, recentGames: res.recent });
    } catch (_err) {
      // Non-blocking in dev if no games yet
    }
  },

  setCurrentGame: (game) => {
    set({ currentGame: game });
  },
}));
