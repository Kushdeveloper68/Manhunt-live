import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceMeters,
  bearingDegrees,
  compassPoint,
  destinationPoint,
  circleRing,
  worldWithHole,
  metersInsideZone,
  formatDistance,
  formatAge,
  nearestOf,
  zoneBounds,
  SOCKET_EVENTS,
} from '@manhunt/shared';
import { gameStateStore, LiveGameState } from '../game/gameStateStore.js';
import { gameLoopManager } from '../game/gameLoop.js';

const A = { latitude: 23.0225, longitude: 72.5714 }; // Ahmedabad

test('distance: known value and symmetry', () => {
  const B = { latitude: 23.0225, longitude: 72.5814 }; // ~1.02 km east
  const d = distanceMeters(A, B);
  assert.ok(d > 1000 && d < 1100, `got ${d}`);
  assert.ok(Math.abs(d - distanceMeters(B, A)) < 1e-6);
  assert.equal(distanceMeters(A, A), 0);
});

test('bearing and compass points', () => {
  assert.ok(Math.abs(bearingDegrees(A, { latitude: A.latitude + 0.01, longitude: A.longitude }) - 0) < 0.5);
  assert.ok(Math.abs(bearingDegrees(A, { latitude: A.latitude, longitude: A.longitude + 0.01 }) - 90) < 0.5);
  assert.equal(compassPoint(0), 'N');
  assert.equal(compassPoint(44), 'NE');
  assert.equal(compassPoint(181), 'S');
  assert.equal(compassPoint(359), 'N');
});

test('destinationPoint round-trips with distance and bearing', () => {
  const p = destinationPoint(A, 45, 500);
  assert.ok(Math.abs(distanceMeters(A, p) - 500) < 1);
  assert.ok(Math.abs(bearingDegrees(A, p) - 45) < 0.5);
});

test('circleRing is closed and every point is radius metres from the centre', () => {
  const ring = circleRing(A, 800, 32);
  assert.equal(ring.length, 33);
  assert.deepEqual(ring[0], ring[32]);
  for (const [lon, lat] of ring) {
    assert.ok(Math.abs(distanceMeters(A, { latitude: lat, longitude: lon }) - 800) < 2);
  }
});

test('worldWithHole has the zone as a hole (so only the OUTSIDE is dimmed)', () => {
  const ring = circleRing(A, 500, 16);
  const poly = worldWithHole(ring);
  assert.equal(poly.length, 2);
  assert.equal(poly[0].length, 5);
  assert.equal(poly[1].length, ring.length);
});

test('metersInsideZone: positive inside, negative outside', () => {
  const zone = { center: A, radius: 1000 };
  assert.ok(metersInsideZone(A, zone) === 1000);
  assert.ok(metersInsideZone(destinationPoint(A, 90, 1200), zone) < -150);
});

test('formatters', () => {
  assert.equal(formatDistance(84.4), '84 m');
  assert.equal(formatDistance(1234), '1.2 km');
  assert.equal(formatDistance(25000), '25 km');
  assert.equal(formatAge(42_000), '42s ago');
  assert.equal(formatAge(185_000), '3m ago');
});

test('nearestOf picks the closest ping with a bearing', () => {
  const far = { id: 'far', coordinates: destinationPoint(A, 0, 900) };
  const near = { id: 'near', coordinates: destinationPoint(A, 90, 120) };
  const hit = nearestOf(A, [far, near])!;
  assert.equal(hit.item.id, 'near');
  assert.ok(Math.abs(hit.meters - 120) < 1);
  assert.ok(Math.abs(hit.bearing - 90) < 0.5);
  assert.equal(nearestOf(A, []), null);
});

test('zoneBounds contains the whole zone', () => {
  const [w, s, e, n] = zoneBounds({ center: A, radius: 1000 });
  assert.ok(w < A.longitude && e > A.longitude && s < A.latitude && n > A.latitude);
});

test('server sends ONE in-app shrink warning per stage, with the next zone preview', async () => {
  const roomEmits: [string, any][] = [];
  (gameLoopManager as any).io = {
    sockets: { adapter: { rooms: new Map() }, sockets: new Map() },
    to: () => ({ emit: (e: string, p: any) => roomEmits.push([e, p]) }),
  };
  const now = Date.now();
  const state: LiveGameState = {
    gameId: 'warnA',
    code: 'WARNA',
    name: 'T',
    hostId: 'h',
    status: 'running',
    settings: {
      zone: { center: A, radius: 1000 },
      noGoZones: [],
      durationMin: 60,
      headStartMin: 1,
      revealIntervalMin: 2,
      revealMode: 'RUNNERS_TO_CHASERS',
      zoneShrink: { startAfterMin: 20, percent: 25, count: 2 },
      tagMethod: 'CODE',
      outOfZonePenalty: 'WARNING',
      teamVisibility: 'TEAMMATES_ONLY',
    },
    players: [
      { userId: 'h', username: 'h', role: 'CHASER', status: 'ACTIVE', ready: true },
      { userId: 'r', username: 'r', role: 'RUNNER', status: 'ACTIVE', ready: true },
    ],
    shrinkStage: 0,
    currentZone: { center: A, radius: 1000 },
    locations: new Map(),
    runnerSnapshots: [],
    tagCodes: new Map(),
    startedAt: now - 1000,
    nextShrinkAt: now + 45_000,
    nextRevealAt: now + 600_000,
  };
  await gameStateStore.set('warnA', state);
  (gameLoopManager as any).sendPushWarnings(state, now, 2);
  (gameLoopManager as any).sendPushWarnings(state, now + 1000, 2); // must not repeat

  const warns = roomEmits.filter(([e]) => e === SOCKET_EVENTS.ZONE_SHRINK_WARNING);
  assert.equal(warns.length, 1);
  assert.equal(warns[0][1].stage, 1);
  assert.equal(warns[0][1].nextZone.radius, 750);
  assert.ok(warns[0][1].secondsLeft > 40 && warns[0][1].secondsLeft <= 45);
});
