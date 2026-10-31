/**
 * MANHUNT LIVE - Pure Game Math
 * All functions are pure (no side-effects, no DB/socket dependencies).
 * Unit-tested in tests/game.test.ts.
 */

import { Coordinates, ZoneSettings, LivePlayerLocation } from '@manhunt/shared';

const EARTH_RADIUS_M = 6_371_000;

/**
 * Haversine distance between two GPS coordinates (metres).
 */
export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aHav = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aHav), Math.sqrt(1 - aHav));
  return EARTH_RADIUS_M * c;
}

/**
 * Is the given coordinate inside the circular zone?
 */
export function isInsideZone(coord: Coordinates, zone: ZoneSettings): boolean {
  return haversineDistance(coord, zone.center) <= zone.radius;
}

/**
 * How many metres outside the zone is this coordinate?
 * Returns 0 if inside.
 */
export function distanceOutsideZone(coord: Coordinates, zone: ZoneSettings): number {
  const dist = haversineDistance(coord, zone.center);
  return Math.max(0, dist - zone.radius);
}

/**
 * Speed check: returns true if the speed jump is physically impossible.
 * Uses distance / elapsed-seconds vs MAX_SPEED_M_S.
 */
const MAX_SPEED_M_S = 15; // ~54 km/h — faster than any sprinter
export function isImpossibleSpeedJump(
  prev: LivePlayerLocation,
  next: LivePlayerLocation
): boolean {
  const elapsedSec = (next.timestamp - prev.timestamp) / 1000;
  if (elapsedSec <= 0) return true; // backward or same time
  const dist = haversineDistance(prev.coordinates, next.coordinates);
  return dist / elapsedSec > MAX_SPEED_M_S;
}

/**
 * Shrink a zone by the given percent. Returns new ZoneSettings.
 * Minimum radius clamped to 100 m.
 */
export function shrinkZone(zone: ZoneSettings, percent: number): ZoneSettings {
  const newRadius = Math.max(100, zone.radius * (1 - percent / 100));
  return { center: zone.center, radius: newRadius };
}

/**
 * Computes the next reveal timestamp from the current server time and the interval.
 */
export function nextRevealTimestamp(nowMs: number, intervalMin: number): number {
  return nowMs + intervalMin * 60 * 1000;
}

/**
 * Computes the next zone-shrink timestamp.
 */
export function nextShrinkTimestamp(startAfterMs: number, intervalMs: number, stage: number): number {
  return startAfterMs + intervalMs * stage;
}

/**
 * Formats ms remaining into "MM:SS" countdown string.
 */
export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Generates a random 4-digit tag code.
 */
export function generateTagCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
