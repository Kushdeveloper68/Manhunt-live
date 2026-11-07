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

  // Extract teammate live locations only
  const visibleTeammateLocations: LivePlayerLocation[] = [];
  for (const [userId, loc] of state.locations.entries()) {
    const locPlayer = state.players.find((p) => p.userId === userId);
    if (!locPlayer) continue;

    // Teammate condition: same role, active status
    if (locPlayer.role === targetRole && targetRole !== 'UNASSIGNED') {
      visibleTeammateLocations.push(loc);
    }
  }

  // Determine runner snapshots visible to this player
  let visibleRunnerSnapshots: RunnerSnapshot[] = [];
  if (targetRole === 'CHASER') {
    // Chasers see the periodic snapshots captured at reveal ticks
    visibleRunnerSnapshots = [...state.runnerSnapshots];
  } else if (state.settings.revealMode === 'BOTH_WAYS') {
    visibleRunnerSnapshots = [...state.runnerSnapshots];
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
    })),
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    serverTime: Date.now(),
    currentZone: state.currentZone,
    nextRevealTimestamp: state.nextRevealAt,
    nextShrinkTimestamp: state.nextShrinkAt,
    teammateLocations: visibleTeammateLocations,
    runnerSnapshots: visibleRunnerSnapshots,
  };
}

/**
 * Checks whether a live location broadcast from sendingUserId can be delivered to recipientUserId.
 * Returns true ONLY if they are on the same team.
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
  if (sender.role === 'UNASSIGNED' || recipient.role === 'UNASSIGNED') return false;

  // Strict rule: live locations are teammates-only
  return sender.role === recipient.role;
}
