/**
 * MANHUNT LIVE - Pure friendship rules (no DB). Routes stay thin; rules are unit-tested.
 */

export type FriendStatus = 'IN_GAME' | 'IN_LOBBY' | 'ONLINE' | 'OFFLINE';
export type Relationship = 'NONE' | 'FRIEND' | 'REQUEST_SENT' | 'REQUEST_RECEIVED';

/** Order-independent key for a pair of users. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

export interface ExistingFriendship {
  requester: string;
  recipient: string;
  status: 'PENDING' | 'ACCEPTED';
}

export type RequestDecision =
  | { action: 'CREATE' }
  | { action: 'AUTO_ACCEPT' }
  | { action: 'REJECT'; message: string; statusCode: number };

/** What should happen when `me` sends a friend request to `them`? */
export function decideFriendRequest(
  me: string,
  them: string,
  existing: ExistingFriendship | null
): RequestDecision {
  if (me === them) return { action: 'REJECT', message: 'You cannot add yourself', statusCode: 400 };
  if (!existing) return { action: 'CREATE' };
  if (existing.status === 'ACCEPTED') {
    return { action: 'REJECT', message: 'You are already friends', statusCode: 409 };
  }
  if (existing.requester === them) return { action: 'AUTO_ACCEPT' }; // they already asked me
  return { action: 'REJECT', message: 'Friend request already sent', statusCode: 409 };
}

export function relationshipOf(me: string, existing: ExistingFriendship | null): Relationship {
  if (!existing) return 'NONE';
  if (existing.status === 'ACCEPTED') return 'FRIEND';
  return existing.requester === me ? 'REQUEST_SENT' : 'REQUEST_RECEIVED';
}

export function deriveFriendStatus(input: {
  online: boolean;
  inGame: boolean;
  lobbyName?: string;
}): { status: FriendStatus; statusDetail?: string } {
  if (input.inGame) return { status: 'IN_GAME', statusDetail: 'IN GAME' };
  if (input.lobbyName) return { status: 'IN_LOBBY', statusDetail: `IN LOBBY: ${input.lobbyName.toUpperCase()}` };
  if (input.online) return { status: 'ONLINE', statusDetail: 'ONLINE' };
  return { status: 'OFFLINE' };
}

export function lastSeenLabel(lastSeenAt: Date | undefined, now: number = Date.now()): string | undefined {
  if (!lastSeenAt) return undefined;
  const mins = Math.max(0, Math.floor((now - lastSeenAt.getTime()) / 60000));
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `${mins}M AGO`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'YESTERDAY' : `${days}D AGO`;
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
