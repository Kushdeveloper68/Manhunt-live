import { Server } from 'socket.io';

let ioRef: Server | null = null;

export function setPresenceIo(io: Server) {
  ioRef = io;
}

export const userRoom = (userId: string) => `user:${userId}`;

/** A user is online if at least one authenticated socket is connected. */
export function isOnline(userId: string): boolean {
  return (ioRef?.sockets.adapter.rooms.get(userRoom(userId))?.size ?? 0) > 0;
}

/** Emit to every connected device of a user, regardless of which game room they are in. */
export function emitToUserAnywhere(userId: string, event: string, payload: unknown): void {
  ioRef?.to(userRoom(userId)).emit(event, payload);
}
