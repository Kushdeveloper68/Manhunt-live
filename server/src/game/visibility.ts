import {
  GameStateSync,
  LivePlayerLocation,
  PlayerRole,
  RunnerSnapshot,
} from '@manhunt/shared';
import { LiveGameState } from './gameStateStore.js';

/**
 * Server-authoritative visibility filter.
 * Ensures a player receives ONLY what their role is allowed to see.
 *
 * Rules:
 * 1. Teammates see each other's live locations in real-time.
 * 2. Chasers NEVER receive a Runner's live location.
 * 3. Chasers ONLY receive RunnerSnapshots generated at reveal ticks.
 * 4. Runners do not receive Chaser live locations (unless revealMode === 'BOTH_WAYS').
 */
export function filterStateForPlayer(
  state: LiveGameState,
  targetUserId: string
): GameStateSync {
  const targetPlayer = state.players.find((p) => p.userId === targetUserId);
  const targetRole: PlayerRole = targetPlayer?.role || 'UNASSIGNED';
  const isSpectator = targetPlayer?.status === 'ELIMINATED';

  // Extract visible live locations
  const visibleTeammateLocations: LivePlayerLocation[] = [];
  for (const [userId, loc] of state.locations.entries()) {
    const locPlayer = state.players.find((p) => p.userId === userId);
    if (!locPlayer) continue;

    // Spectator God-view: see everyone!
    if (isSpectator) {
      visibleTeammateLocations.push(loc);
      continue;
    }

    // Teammate condition: same role, active status
    if (locPlayer.role === targetRole && targetRole !== 'UNASSIGNED') {
      visibleTeammateLocations.push(loc);
      continue;
    }

    // Zone-penalty REVEAL: a runner who stayed out of bounds is permanently visible to chasers
    if (
      targetRole === 'CHASER' &&
      locPlayer.role === 'RUNNER' &&
      locPlayer.status === 'ACTIVE' &&
      state.permanentReveal?.has(userId)
    ) {
      visibleTeammateLocations.push(loc);
    }
  }

  // Determine runner snapshots visible to this player
  let visibleRunnerSnapshots: RunnerSnapshot[] = [];
  if (targetRole === 'CHASER' || isSpectator) {
    // Chasers and Spectators see the periodic snapshots captured at reveal ticks
    visibleRunnerSnapshots = [...state.runnerSnapshots];
  }

  // BOTH_WAYS: runners get periodic snapshots of the CHASERS (never of their own team)
  let visibleChaserSnapshots: RunnerSnapshot[] | undefined;
  if (state.settings.revealMode === 'BOTH_WAYS' && (targetRole === 'RUNNER' || isSpectator)) {
    visibleChaserSnapshots = [...(state.chaserSnapshots || [])];
  }

  return {
    gameId: state.gameId,
    code: state.code,
    name: state.name,
    hostId: state.hostId,
    status: state.status,
    settings: state.settings,
    players: state.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      avatarId: p.avatarId,
      role: p.role,
      status: p.status,
      ready: p.ready,
      isHost: p.isHost,
      // Provide tag code only to the runner themselves
      tagCode: p.userId === targetUserId ? state.tagCodes.get(p.userId) : undefined,
      taggedAt: p.taggedAt,
      taggedBy: p.taggedBy,
    })),
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    serverTime: Date.now(),
    currentZone: state.currentZone,
    nextRevealTimestamp: state.nextRevealAt,
    nextShrinkTimestamp: state.nextShrinkAt,
    teammateLocations: visibleTeammateLocations,
    runnerSnapshots: visibleRunnerSnapshots,
    chaserSnapshots: visibleChaserSnapshots,
  };
}

/**
 * Checks whether a live location broadcast from sendingUserId can be delivered to recipientUserId.
 * Returns true if on the same team OR recipient is in spectator mode (ELIMINATED).
 */
export function canReceiveLiveLocation(
  state: LiveGameState,
  sendingUserId: string,
  recipientUserId: string
): boolean {
  if (sendingUserId === recipientUserId) return true;

  const sender = state.players.find((p) => p.userId === sendingUserId);
  const recipient = state.players.find((p) => p.userId === recipientUserId);

  if (!sender || !recipient) return false;

  // Spectators have unlocked God-view
  if (recipient.status === 'ELIMINATED') return true;

  if (sender.role === 'UNASSIGNED' || recipient.role === 'UNASSIGNED') return false;

  // Zone-penalty REVEAL: permanently exposed runners are visible to chasers
  if (
    sender.role === 'RUNNER' &&
    recipient.role === 'CHASER' &&
    state.permanentReveal?.has(sender.userId)
  ) {
    return true;
  }

  // Strict rule: live locations are teammates-only
  return sender.role === recipient.role;
}
