/**
 * MANHUNT LIVE - Socket.io Client Service
 * Singleton socket connection with JWT auth injection and auto-reconnect.
 * Reconnects are managed by socket.io-client; on successful reconnect,
 * the server should receive a game:join to trigger full state resync.
 */

import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS, GameStateSync } from '@manhunt/shared';
import Constants from 'expo-constants';
import { useConnectionStore, MAX_RECONNECT_ATTEMPTS } from '../stores/connectionStore';

/**
 * Where the game server lives. Priority:
 *   1. EXPO_PUBLIC_SOCKET_URL
 *   2. EXPO_PUBLIC_API_URL without its "/api" (so ONE setting is enough)
 *   3. expo "extra.serverUrl"
 *   4. 10.0.2.2:4000 (the Android EMULATOR's alias for your PC; a real phone can never use it)
 */
function resolveServerUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_SOCKET_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const api = process.env.EXPO_PUBLIC_API_URL;
  if (api) return api.replace(/\/$/, '').replace(/\/api$/, '');
  return (Constants.expoConfig?.extra?.serverUrl as string | undefined) ?? 'http://10.0.2.2:4000';
}

const SERVER_URL: string = resolveServerUrl();
console.log(`[config] game server (socket): ${SERVER_URL}`);

export const getServerUrl = (): string => SERVER_URL;
export const isEmulatorAddress = (): boolean => SERVER_URL.includes('10.0.2.2');

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

  // Feed the "SIGNAL LOST" banner
  const conn = useConnectionStore.getState();
  socket.on('connect', () => conn.setConnected());
  socket.on('connect_error', (err: Error) => conn.setError(err.message));
  socket.on('disconnect', (reason: string) => {
    if (reason !== 'io client disconnect') conn.setDisconnected(); // ignore our own disconnects
  });
  socket.io.on('reconnect_attempt', (n: number) => conn.setAttempt(Math.min(n, MAX_RECONNECT_ATTEMPTS)));
  socket.io.on('reconnect_failed', () => conn.setFailed());

  return socket;
}

/**
 * Disconnect and clear the socket (e.g. on logout).
 */
export function disconnectSocket(): void {
  useConnectionStore.getState().setConnected(); // no banner after an intentional disconnect
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

/** Manual retry after automatic reconnecting gave up. */
export function retryConnection(): void {
  if (!socket) return;
  useConnectionStore.getState().setAttempt(1);
  socket.connect();
}
