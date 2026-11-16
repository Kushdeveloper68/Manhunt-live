/**
 * MANHUNT LIVE - Fair-play checks on incoming GPS fixes (pure: no sockets, no DB).
 *
 * - Mock/fake GPS: the fix is rejected; 3 strikes in a match and the player is removed.
 * - Teleporting / vehicle-speed jumps: the fix is rejected. One-off GPS glitches fix themselves
 *   (the next normal fix is accepted and resets the counter); only a sustained run of
 *   impossible jumps removes the player.
 */
import { LivePlayerLocation } from '@manhunt/shared';
import { haversineDistance } from './math.js';

export const MOCK_STRIKES_TO_REMOVE = 3;
export const TELEPORT_STRIKES_TO_REMOVE = 6;
/** Faster than this is not a person on foot (~54 km/h). */
export const MAX_HUMAN_SPEED_M_S = 15;
/** Jumps smaller than this are GPS noise, never judged. */
export const MIN_JUMP_METERS = 50;

export interface FairPlayRecord {
  mock: number;
  /** consecutive impossible jumps */
  jumps: number;
}

export type CheatKind = 'MOCK_GPS' | 'TELEPORT';

export interface Verdict {
  /** false: do not use this fix */
  accept: boolean;
  record: FairPlayRecord;
  kind?: CheatKind;
  /** tell the player to stop */
  warn: boolean;
  /** remove the player from the match */
  remove: boolean;
}

export function judgeLocation(
  prev: LivePlayerLocation | undefined,
  next: LivePlayerLocation,
  record: FairPlayRecord,
  now: number
): Verdict {
  if (next.isMock) {
    const mock = record.mock + 1;
    return {
      accept: false,
      kind: 'MOCK_GPS',
      warn: mock < MOCK_STRIKES_TO_REMOVE,
      remove: mock >= MOCK_STRIKES_TO_REMOVE,
      record: { mock, jumps: record.jumps },
    };
  }

  if (prev) {
    // Server time only: client timestamps can be forged
    const elapsedSec = (now - (prev.receivedAt ?? prev.timestamp)) / 1000;
    const dist = haversineDistance(prev.coordinates, next.coordinates);
    if (elapsedSec > 0 && dist >= MIN_JUMP_METERS && dist / elapsedSec > MAX_HUMAN_SPEED_M_S) {
      const jumps = record.jumps + 1;
      return {
        accept: false,
        kind: 'TELEPORT',
        warn: jumps === Math.floor(TELEPORT_STRIKES_TO_REMOVE / 2),
        remove: jumps >= TELEPORT_STRIKES_TO_REMOVE,
        record: { mock: record.mock, jumps },
      };
    }
  }

  return { accept: true, warn: false, remove: false, record: { mock: record.mock, jumps: 0 } };
}

/** Sliding-window limiter for ALL socket events of one connection (spam / flooding protection). */
export class EventRateLimiter {
  private times: number[] = [];
  private violations = 0;
  constructor(private maxEvents: number, private windowMs: number, private maxViolations: number) {}

  /** 'ok' = process it, 'drop' = ignore it, 'disconnect' = kick this connection */
  hit(now: number = Date.now()): 'ok' | 'drop' | 'disconnect' {
    this.times = this.times.filter((t) => now - t < this.windowMs);
    if (this.times.length >= this.maxEvents) {
      this.violations += 1;
      return this.violations > this.maxViolations ? 'disconnect' : 'drop';
    }
    this.times.push(now);
    return 'ok';
  }
}
