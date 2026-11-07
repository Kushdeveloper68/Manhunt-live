import { Coordinates, NoGoZone, OutOfZonePenalty } from '@manhunt/shared';

/**
 * Ray-casting algorithm to determine if a point is inside a polygon.
 */
export function isPointInPolygon(point: Coordinates, polygon: Coordinates[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  const x = point.longitude;
  const y = point.latitude;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Checks if the player's coordinate breaches any No-Go zone polygon.
 */
export function checkNoGoZoneBreach(
  point: Coordinates,
  noGoZones: NoGoZone[]
): { inViolation: boolean; zoneId?: string; zoneName?: string } {
  for (const zone of noGoZones) {
    if (isPointInPolygon(point, zone.polygon)) {
      return { inViolation: true, zoneId: zone.id, zoneName: zone.name };
    }
  }
  return { inViolation: false };
}

/**
 * Calculates compass bearing from point A to point B in degrees (0 - 360).
 */
export function calculateBearing(from: Coordinates, to: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLon = toRad(to.longitude - from.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Converts compass degrees to human readable cardinal direction (e.g. SOUTH-WEST).
 */
export function getCardinalDirection(bearing: number): string {
  const directions = [
    'NORTH',
    'NORTH-EAST',
    'EAST',
    'SOUTH-EAST',
    'SOUTH',
    'SOUTH-WEST',
    'WEST',
    'NORTH-WEST',
  ];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

export interface ZonePenaltyResult {
  action: 'WARNING' | 'REVEAL' | 'ELIMINATE';
  countdownSec: number;
  message: string;
}

const GRACE_PERIOD_SEC = 30;

/**
 * Evaluates the penalty for a player who has breached the game perimeter.
 * Host configured options:
 * - WARNING: alerts continuously
 * - REVEAL: location is revealed to all chasers after 30s grace period
 * - ELIMINATE: player is disqualified after 30s grace period
 */
export function evaluateOutOfZonePenalty(
  penaltyRule: OutOfZonePenalty,
  secondsInBreach: number,
  distanceOutsideMeters: number
): ZonePenaltyResult {
  const remainingSec = Math.max(0, GRACE_PERIOD_SEC - secondsInBreach);

  if (penaltyRule === 'WARNING') {
    return {
      action: 'WARNING',
      countdownSec: remainingSec,
      message: `OUT OF BOUNDS: ${Math.round(distanceOutsideMeters)}M past perimeter barrier. Re-enter immediately.`,
    };
  }

  if (penaltyRule === 'REVEAL') {
    if (remainingSec === 0) {
      return {
        action: 'REVEAL',
        countdownSec: 0,
        message: 'PENALTY ACTIVE: Your live coordinates are now broadcasting to ALL chasers!',
      };
    }
    return {
      action: 'WARNING',
      countdownSec: remainingSec,
      message: `PENALTY WARNING: GPS broadcasting to ALL chasers in ${remainingSec}s`,
    };
  }

  // ELIMINATE
  if (remainingSec === 0) {
    return {
      action: 'ELIMINATE',
      countdownSec: 0,
      message: 'ELIMINATED: Disqualified for perimeter breach exceeding 30s.',
    };
  }
  return {
    action: 'WARNING',
    countdownSec: remainingSec,
    message: `ELIMINATION WARNING: Disqualification in ${remainingSec}s unless re-entered!`,
  };
}
