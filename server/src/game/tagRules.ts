/**
 * MANHUNT LIVE - Pure tag rules (no sockets, no DB).
 * Unit-tested in tests/securityB.test.ts.
 */
import { LivePlayerLocation } from '@manhunt/shared';
import { haversineDistance } from './math.js';

/** Both phones must be within this distance for a tag to be valid. GPS error is ~10-30 m. */
export const TAG_MAX_DISTANCE_METERS = 50;
/** Location must have been received by the server within this window. */
export const TAG_LOCATION_MAX_AGE_MS = 60_000;
/** Runner has this long to confirm/dispute before the tag is auto-confirmed. */
export const TAG_AUTO_CONFIRM_MS = 45_000;
/** Wrong-code guesses allowed per chaser per window (4-digit codes are brute-forceable). */
export const TAG_CODE_MAX_FAILS = 5;
export const TAG_CODE_FAIL_WINDOW_MS = 60_000;
/** After a runner disputes, the same chaser cannot retry on that runner for this long. */
export const TAG_DISPUTE_COOLDOWN_MS = 30_000;

export type ProximityResult =
  | { ok: true; distanceMeters: number }
  | { ok: false; reason: 'NO_LOCATION' | 'STALE_LOCATION' | 'TOO_FAR' };

function ageOf(loc: LivePlayerLocation, now: number): number {
  // Trust the server receive time; fall back to client timestamp only if absent.
  return now - (loc.receivedAt ?? loc.timestamp);
}

/**
 * Fail-CLOSED proximity check: a tag is only valid when the server has a recent
 * location for BOTH players and they are within TAG_MAX_DISTANCE_METERS.
 */
export function validateTagProximity(
  chaserLoc: LivePlayerLocation | undefined,
  runnerLoc: LivePlayerLocation | undefined,
  now: number = Date.now()
): ProximityResult {
  if (!chaserLoc || !runnerLoc) return { ok: false, reason: 'NO_LOCATION' };
  if (
    ageOf(chaserLoc, now) > TAG_LOCATION_MAX_AGE_MS ||
    ageOf(runnerLoc, now) > TAG_LOCATION_MAX_AGE_MS
  ) {
    return { ok: false, reason: 'STALE_LOCATION' };
  }
  const distanceMeters = Math.round(
    haversineDistance(chaserLoc.coordinates, runnerLoc.coordinates)
  );
  if (distanceMeters > TAG_MAX_DISTANCE_METERS) return { ok: false, reason: 'TOO_FAR' };
  return { ok: true, distanceMeters };
}

/** Sliding-window failure counter (wrong tag codes, etc). */
export class FailureLimiter {
  private hits = new Map<string, number[]>();
  constructor(private maxFails: number, private windowMs: number) {}

  private recent(key: string, now: number): number[] {
    const list = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  isBlocked(key: string, now: number = Date.now()): boolean {
    return this.recent(key, now).length >= this.maxFails;
  }

  recordFailure(key: string, now: number = Date.now()): void {
    const list = this.recent(key, now);
    list.push(now);
    this.hits.set(key, list);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  clearPrefix(prefix: string): void {
    for (const key of this.hits.keys()) if (key.startsWith(prefix)) this.hits.delete(key);
  }
}
