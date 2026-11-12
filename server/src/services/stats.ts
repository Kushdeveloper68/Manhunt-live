import mongoose from 'mongoose';
import { Game } from '../models/Game.js';
import { User } from '../models/User.js';
import { MatchSummary, computeStatDeltas } from '../game/matchSummary.js';
import { logger } from '../logger.js';

/**
 * Saves the match summary and adds each player's stats - exactly once per game
 * (guarded atomically by Game.statsApplied), so a retry or double endGame can't double count.
 */
export async function persistMatchResult(gameId: string, summary: MatchSummary): Promise<boolean> {
  if (!mongoose.isValidObjectId(gameId)) return false;
  try {
    const claimed = await Game.findOneAndUpdate(
      { _id: gameId, statsApplied: { $ne: true } },
      {
        $set: {
          statsApplied: true,
          'result.summary': summary,
          ...(summary.mvpUserId && mongoose.isValidObjectId(summary.mvpUserId)
            ? { 'result.mvpUserId': summary.mvpUserId }
            : {}),
        },
      },
      { new: true }
    );
    if (!claimed) return false; // already applied

    const ops = [...computeStatDeltas(summary).entries()]
      .filter(([userId]) => mongoose.isValidObjectId(userId))
      .map(([userId, d]) => ({
        updateOne: {
          filter: { _id: userId },
          update: {
            $inc: {
              'stats.games': d.games,
              'stats.wins': d.wins,
              'stats.tags': d.tags,
              'stats.escapes': d.escapes,
              'stats.kmRun': d.kmRun,
            },
          },
        },
      }));
    if (ops.length) await User.bulkWrite(ops);
    return true;
  } catch (err) {
    logger.error('Failed to persist match result:', err);
    return false;
  }
}
