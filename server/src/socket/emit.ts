import { Server } from 'socket.io';

/**
 * Emit an event to every socket of one specific user inside a game room.
 * Used for anything that must NOT reach the rest of the room (zone warnings,
 * tag prompts, SOS confirmations).
 */
export function emitToUser(
  io: Server,
  gameId: string,
  userId: string,
  event: string,
  payload: unknown
): void {
  const sockets = io.sockets.adapter.rooms.get(`game:${gameId}`);
  if (!sockets) return;
  for (const socketId of sockets) {
    const sock = io.sockets.sockets.get(socketId) as any;
    if (sock?.data?.user?.userId === userId) {
      sock.emit(event, payload);
    }
  }
}
