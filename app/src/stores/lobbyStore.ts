/**
 * MANHUNT LIVE - Lobby Store (Zustand)
 * Manages real-time lobby state driven by socket events.
 * All mutations originate from the server; this store is read-only from the UI.
 */

import { create } from 'zustand';
import { GameStateSync, GamePlayer } from '@manhunt/shared';
import { SOCKET_EVENTS } from '@manhunt/shared';
import {
  connectSocket,
  disconnectSocket,
  emitJoinGame,
  emitLeaveGame,
  emitRoleAssign,
  emitRoleRandomize,
  emitPlayerReady,
  emitKickPlayer,
  emitAddPlayer,
  emitGameStart,
  getSocket,
} from '../services/socket';

interface LobbyState {
  /** Full server-authoritative game state */
  gameState: GameStateSync | null;
  /** Whether we are currently connected to the socket room */
  connected: boolean;
  /** Error message from socket errors */
  socketError: string | null;
  /** Whether the game has just launched (navigate away) */
  gameStarted: boolean;

  // ---- Connection lifecycle ----
  joinLobby: (token: string, gameId?: string, code?: string) => void;
  leaveLobby: (gameId: string) => void;
  disconnectLobby: () => void;

  // ---- Host actions ----
  assignRole: (gameId: string, targetUserId: string, role: 'CHASER' | 'RUNNER' | 'UNASSIGNED') => void;
  autoAssignRoles: (gameId: string) => void;
  kickPlayer: (gameId: string, targetUserId: string) => void;
  addPlayerByUsername: (gameId: string, username: string) => void;
  startGame: (gameId: string) => void;

  // ---- Player actions ----
  setReady: (gameId: string, ready: boolean) => void;

  // ---- Internal setters (called from socket event handlers) ----
  _setGameState: (state: GameStateSync) => void;
  _setConnected: (connected: boolean) => void;
  _setSocketError: (error: string | null) => void;
  _setGameStarted: (started: boolean) => void;
  _reset: () => void;
}

export const useLobbyStore = create<LobbyState>((set, get) => ({
  gameState: null,
  connected: false,
  socketError: null,
  gameStarted: false,

  joinLobby: (token: string, gameId?: string, code?: string) => {
    const socket = connectSocket(token);

    // Register one-time listeners (guard against duplicate registration)
    socket.off(SOCKET_EVENTS.GAME_STATE);
    socket.off(SOCKET_EVENTS.LOBBY_UPDATE);
    socket.off(SOCKET_EVENTS.GAME_START);
    socket.off(SOCKET_EVENTS.ERROR);

    socket.on('connect', () => get()._setConnected(true));
    socket.on('disconnect', () => get()._setConnected(false));

    socket.on(SOCKET_EVENTS.GAME_STATE, (data: GameStateSync) => {
      get()._setGameState(data);
    });

    socket.on(SOCKET_EVENTS.LOBBY_UPDATE, (data: GameStateSync) => {
      get()._setGameState(data);
    });

    socket.on(SOCKET_EVENTS.GAME_START, () => {
      get()._setGameStarted(true);
    });

    socket.on(SOCKET_EVENTS.ERROR, (data: { message: string }) => {
      get()._setSocketError(data?.message ?? 'Unknown error');
    });

    // Emit join once connected (or immediately if already connected)
    if (socket.connected) {
      emitJoinGame(gameId, code);
    } else {
      socket.once('connect', () => emitJoinGame(gameId, code));
    }
  },

  leaveLobby: (gameId: string) => {
    emitLeaveGame(gameId);
    get()._reset();
  },

  disconnectLobby: () => {
    disconnectSocket();
    get()._reset();
  },

  assignRole: (gameId, targetUserId, role) => {
    get()._setSocketError(null);
    emitRoleAssign(gameId, targetUserId, role);
  },

  autoAssignRoles: (gameId) => {
    get()._setSocketError(null);
    emitRoleRandomize(gameId);
  },

  kickPlayer: (gameId, targetUserId) => {
    get()._setSocketError(null);
    emitKickPlayer(gameId, targetUserId);
  },

  addPlayerByUsername: (gameId, username) => {
    get()._setSocketError(null);
    emitAddPlayer(gameId, username);
  },

  startGame: (gameId) => {
    get()._setSocketError(null);
    emitGameStart(gameId);
  },

  setReady: (gameId, ready) => {
    get()._setSocketError(null);
    emitPlayerReady(gameId, ready);
  },

  _setGameState: (state) => set({ gameState: state }),
  _setConnected: (connected) => set({ connected }),
  _setSocketError: (socketError) => set({ socketError }),
  _setGameStarted: (gameStarted) => set({ gameStarted }),
  _reset: () =>
    set({
      gameState: null,
      connected: false,
      socketError: null,
      gameStarted: false,
    }),
}));
