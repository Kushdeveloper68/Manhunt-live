import { FailureLimiter, TAG_CODE_FAIL_WINDOW_MS, TAG_CODE_MAX_FAILS } from './tagRules.js';

export interface PendingTagAttempt {
  attemptId: string;
  gameId: string;
  chaserUserId: string;
  chaserUsername: string;
  runnerUserId: string;
  runnerUsername: string;
  createdAt: number;
  expiresAt: number;
  timer: NodeJS.Timeout;
}

/** Active tag verification timers, keyed by attemptId. */
export const pendingTagAttempts = new Map<string, PendingTagAttempt>();

/** Wrong-code limiter, key = `${gameId}:${chaserUserId}`. */
export const tagCodeLimiter = new FailureLimiter(TAG_CODE_MAX_FAILS, TAG_CODE_FAIL_WINDOW_MS);

/** Dispute cooldowns, key = `${gameId}:${chaserUserId}:${runnerUserId}` -> expiry ms. */
export const disputeCooldowns = new Map<string, number>();

export function findPendingForRunner(
  gameId: string,
  runnerUserId: string
): PendingTagAttempt | undefined {
  for (const attempt of pendingTagAttempts.values()) {
    if (attempt.gameId === gameId && attempt.runnerUserId === runnerUserId) return attempt;
  }
  return undefined;
}

export function clearPendingForRunner(gameId: string, runnerUserId: string): void {
  for (const [id, attempt] of pendingTagAttempts.entries()) {
    if (attempt.gameId === gameId && attempt.runnerUserId === runnerUserId) {
      clearTimeout(attempt.timer);
      pendingTagAttempts.delete(id);
    }
  }
}

/** Called when a game ends: no timer may fire and no state may leak afterwards. */
export function clearTagStateForGame(gameId: string): void {
  for (const [id, attempt] of pendingTagAttempts.entries()) {
    if (attempt.gameId === gameId) {
      clearTimeout(attempt.timer);
      pendingTagAttempts.delete(id);
    }
  }
  tagCodeLimiter.clearPrefix(`${gameId}:`);
  for (const key of disputeCooldowns.keys()) if (key.startsWith(`${gameId}:`)) disputeCooldowns.delete(key);
}
