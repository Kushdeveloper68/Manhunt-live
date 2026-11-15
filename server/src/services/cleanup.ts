import { Game } from '../models/Game.js';
import { gameStateStore } from '../game/gameStateStore.js';
import { logger } from '../logger.js';

/** A lobby nobody started within this long is abandoned. */
export const STALE_LOBBY_MS = 3 * 60 * 60 * 1000;

export function staleLobbyCutoff(now: number = Date.now()): Date {
  return new Date(now - STALE_LOBBY_MS);
}

/**
 * Closes games that can never continue, so they stop showing up as "active":
 * - matches marked running/countdown whose live state is gone (the server restarted: state lives in memory)
 * - lobbies that were abandoned
 * None of them count toward player stats.
 */
export async function closeStaleGames(now: number = Date.now()): Promise<number> {
  try {
    const liveIds = (await gameStateStore.listActive()).map((s) => s.gameId);
    const orphaned = await Game.updateMany(
      { status: { $in: ['running', 'countdown'] }, _id: { $nin: liveIds.filter((id) => /^[0-9a-f]{24}$/i.test(id)) } },
      { $set: { status: 'ended', endedAt: new Date(now), statsApplied: true, 'result.reason': 'SERVER_RESTART' } }
    );
    const lobbies = await Game.updateMany(
      { status: 'lobby', createdAt: { $lt: staleLobbyCutoff(now) } },
      { $set: { status: 'ended', endedAt: new Date(now), statsApplied: true, 'result.reason': 'ABANDONED' } }
    );
    const closed = (orphaned.modifiedCount ?? 0) + (lobbies.modifiedCount ?? 0);
    if (closed > 0) logger.info(`Closed ${closed} stale game(s)`);
    return closed;
  } catch (err) {
    logger.warn('Stale game cleanup failed:', err instanceof Error ? err.message : err);
    return 0;
  }
}
