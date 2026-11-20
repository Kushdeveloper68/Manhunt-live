/**
 * MANHUNT LIVE - Pure geo helpers shared by the app (map drawing, arrows, distances)
 * and covered by server-side unit tests.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing from `from` to `to`, 0..360 (0 = north, 90 = east). */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const dLon = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(toRad(to.latitude));
  const x =
    Math.cos(toRad(from.latitude)) * Math.sin(toRad(to.latitude)) -
    Math.sin(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export function compassPoint(bearing: number): (typeof POINTS)[number] {
  return POINTS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

/** Point reached from `start` travelling `meters` along `bearing` degrees. */
export function destinationPoint(start: LatLng, bearing: number, meters: number): LatLng {
  const ang = meters / EARTH_RADIUS_M;
  const brg = toRad(bearing);
  const lat1 = toRad(start.latitude);
  const lon1 = toRad(start.longitude);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(brg));
  const lon2 =
    lon1 + Math.atan2(Math.sin(brg) * Math.sin(ang) * Math.cos(lat1), Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2));
  return { latitude: toDeg(lat2), longitude: ((toDeg(lon2) + 540) % 360) - 180 };
}

/** Closed ring of [lon, lat] points approximating a circle (GeoJSON order). */
export function circleRing(center: LatLng, radiusMeters: number, steps = 64): number[][] {
  const ring: number[][] = [];
  for (let i = 0; i < steps; i++) {
    const p = destinationPoint(center, (i / steps) * 360, radiusMeters);
    ring.push([p.longitude, p.latitude]);
  }
  ring.push(ring[0]);
  return ring;
}

/** Signed area of a [lon, lat] ring (shoelace). Positive = counter-clockwise. */
export function ringArea(ring: number[][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

/** Returns the ring wound the requested way (GeoJSON: exterior counter-clockwise, holes clockwise). */
export function orientRing(ring: number[][], counterClockwise: boolean): number[][] {
  const isCcw = ringArea(ring) > 0;
  return isCcw === counterClockwise ? ring : [...ring].reverse();
}

/**
 * A polygon covering the whole map with the zone cut out: used to dim everything OUTSIDE the zone.
 * Winding follows RFC 7946 (renderers classify exterior vs hole by winding, and a wrong hole
 * winding fills the zone too, which dims the entire map).
 */
export function worldWithHole(hole: number[][]): number[][][] {
  const world = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  return [orientRing(world, true), orientRing(hole, false)];
}

/** A filled polygon for a zone circle (exterior, counter-clockwise). */
export function zonePolygon(ring: number[][]): number[][][] {
  return [orientRing(ring, true)];
}

/** Positive = metres inside the zone edge, negative = metres outside. */
export function metersInsideZone(p: LatLng, zone: { center: LatLng; radius: number }): number {
  return zone.radius - distanceMeters(p, zone.center);
}

/** "85 m" / "1.2 km" */
export function formatDistance(meters: number): string {
  const m = Math.max(0, Math.round(meters));
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

/** "42s ago" / "3m ago" */
export function formatAge(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
}

/** The nearest of `points` to `from`, with distance and bearing; null if there are none. */
export function nearestOf<T extends { coordinates: LatLng }>(
  from: LatLng,
  points: T[]
): { item: T; meters: number; bearing: number } | null {
  let best: { item: T; meters: number } | null = null;
  for (const item of points) {
    const meters = distanceMeters(from, item.coordinates);
    if (!best || meters < best.meters) best = { item, meters };
  }
  return best ? { ...best, bearing: bearingDegrees(from, best.item.coordinates) } : null;
}

/** Map camera box [west, south, east, north] that contains the zone. */
export function zoneBounds(zone: { center: LatLng; radius: number }): [number, number, number, number] {
  const n = destinationPoint(zone.center, 0, zone.radius);
  const s = destinationPoint(zone.center, 180, zone.radius);
  const e = destinationPoint(zone.center, 90, zone.radius);
  const w = destinationPoint(zone.center, 270, zone.radius);
  return [w.longitude, s.latitude, e.longitude, n.latitude];
}
