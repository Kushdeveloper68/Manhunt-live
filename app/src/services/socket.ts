/**
 * MANHUNT LIVE - Socket.io Client Service
 * Singleton socket connection with JWT auth injection and auto-reconnect.
 * Reconnects are managed by socket.io-client; on successful reconnect,
 * the server should receive a game:join to trigger full state resync.
 */

import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS, GameStateSync } from '@manhunt/shared';
import Constants from 'expo-constants';

// Resolve server URL from Expo Constants or fall back to local dev
const SERVER_URL: string =
  (Constants.expoConfig?.extra?.serverUrl as string | undefined) ??
  'http://10.0.2.2:4000'; // Android emulator default

let socket: Socket | null = null;
let authToken: string | null = null;

/**
 * Initialise (or re-use) the singleton socket connection.
 * Call this after the user is authenticated.
 */
export function connectSocket(token: string): Socket {
  if (socket && socket.connected && authToken === token) {
    return socket;
  }

  // Disconnect any existing socket before creating a new one
  if (socket) {
    socket.disconnect();
  }

  authToken = token;

  socket = io(SERVER_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
    transports: ['websocket'],
  });

  return socket;
}

/**
 * Disconnect and clear the socket (e.g. on logout).
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    authToken = null;
  }
}

/**
 * Returns the current socket instance.
 * Throws if connectSocket was not called yet.
 */
export function getSocket(): Socket {
  if (!socket) {
    throw new Error('Socket not initialised. Call connectSocket(token) first.');
  }
  return socket;
}

/**
 * Returns whether the socket is currently connected.
 */
export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

// ---------- Typed lobby actions ----------

export function emitJoinGame(gameId?: string, code?: string): void {
  getSocket().emit(SOCKET_EVENTS.GAME_JOIN, { gameId, code });
}

export function emitLeaveGame(gameId: string): void {
  getSocket().emit(SOCKET_EVENTS.GAME_LEAVE, { gameId });
}

export function emitRoleAssign(
  gameId: string,
  targetUserId: string,
  role: 'CHASER' | 'RUNNER' | 'UNASSIGNED'
): void {
  getSocket().emit(SOCKET_EVENTS.ROLE_ASSIGN, { gameId, targetUserId, role });
}

export function emitRoleRandomize(gameId: string): void {
  getSocket().emit(SOCKET_EVENTS.ROLE_RANDOMIZE, { gameId });
}

export function emitPlayerReady(gameId: string, ready: boolean): void {
  getSocket().emit(SOCKET_EVENTS.PLAYER_READY, { gameId, ready });
}

export function emitKickPlayer(gameId: string, targetUserId: string): void {
  getSocket().emit(SOCKET_EVENTS.PLAYER_KICK, { gameId, targetUserId });
}

export function emitAddPlayer(gameId: string, username: string): void {
  getSocket().emit(SOCKET_EVENTS.PLAYER_ADD, { gameId, username });
}

export function emitGameStart(gameId: string): void {
  getSocket().emit(SOCKET_EVENTS.GAME_START, { gameId });
}
