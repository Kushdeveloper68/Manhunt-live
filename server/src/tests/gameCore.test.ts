import test from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineDistance,
  isInsideZone,
  distanceOutsideZone,
  shrinkZone,
  isImpossibleSpeedJump,
  formatCountdown,
  generateTagCode,
} from '../game/math.js';
import { filterStateForPlayer, canReceiveLiveLocation } from '../game/visibility.js';
import { LiveGameState } from '../game/gameStateStore.js';
import { LivePlayerLocation } from '@manhunt/shared';

test('Haversine distance calculates accurate meters between coordinates', () => {
  // Central Park south to Central Park north (~4.0 km)
  const southCP = { latitude: 40.7644, longitude: -73.9742 };
  const northCP = { latitude: 40.8006, longitude: -73.9581 };

  const dist = haversineDistance(southCP, northCP);
  assert.ok(dist > 4000 && dist < 4500, `Expected ~4.2km, got ${dist}`);

  // Same point distance should be 0
  assert.equal(Math.round(haversineDistance(southCP, southCP)), 0);
});

test('Zone containment and distance outside zone', () => {
  const center = { latitude: 40.7829, longitude: -73.9654 };
  const zone = { center, radius: 1000 }; // 1km radius

  // Center is strictly inside
  assert.equal(isInsideZone(center, zone), true);
  assert.equal(distanceOutsideZone(center, zone), 0);

  // Point ~200m away is inside
  const nearPoint = { latitude: 40.784, longitude: -73.9654 };
  assert.equal(isInsideZone(nearPoint, zone), true);
  assert.equal(distanceOutsideZone(nearPoint, zone), 0);

  // Point ~4km away is outside
  const farPoint = { latitude: 40.82, longitude: -73.9654 };
  assert.equal(isInsideZone(farPoint, zone), false);
  const distOut = distanceOutsideZone(farPoint, zone);
  assert.ok(distOut > 3000, `Expected >3km outside, got ${distOut}`);
});

test('Zone shrink logic reduces radius and respects 100m minimum clamp', () => {
  const zone = { center: { latitude: 40.78, longitude: -73.96 }, radius: 1000 };
  const shrunk = shrinkZone(zone, 25);
  assert.equal(shrunk.radius, 750);

  // Shrink past minimum
  const tinyZone = { center: { latitude: 40.78, longitude: -73.96 }, radius: 120 };
  const clamped = shrinkZone(tinyZone, 50);
  assert.equal(clamped.radius, 100);
});

test('Anti-cheat: Impossible speed jump detection (> 15 m/s)', () => {
  const p1: LivePlayerLocation = {
    userId: 'u1',
    username: 'runner1',
    role: 'RUNNER',
    coordinates: { latitude: 40.78, longitude: -73.96 },
    timestamp: 10000,
  };

  // Normal run: 20 meters in 4 seconds = 5 m/s -> valid
  const pValid: LivePlayerLocation = {
    userId: 'u1',
    username: 'runner1',
    role: 'RUNNER',
    coordinates: { latitude: 40.78018, longitude: -73.96 },
    timestamp: 14000,
  };
  assert.equal(isImpossibleSpeedJump(p1, pValid), false);

  // Teleport jump: 500 meters in 2 seconds = 250 m/s -> impossible!
  const pCheat: LivePlayerLocation = {
    userId: 'u1',
    username: 'runner1',
    role: 'RUNNER',
    coordinates: { latitude: 40.7845, longitude: -73.96 },
    timestamp: 12000,
  };
  assert.equal(isImpossibleSpeedJump(p1, pCheat), true);
});

test('Tag code generator produces valid 4-digit numeric code', () => {
  for (let i = 0; i < 20; i++) {
    const code = generateTagCode();
    assert.equal(code.length, 4);
    assert.match(code, /^[0-9]{4}$/);
  }
});

test('formatCountdown outputs MM:SS correctly', () => {
  assert.equal(formatCountdown(299000), '04:59');
  assert.equal(formatCountdown(60000), '01:00');
  assert.equal(formatCountdown(45000), '00:45');
  assert.equal(formatCountdown(0), '00:00');
});

test('VISIBILITY FILTERING: Chasers NEVER receive Runner live location', () => {
  const chaserUser = 'chaser_1';
  const runner1User = 'runner_1';
  const runner2User = 'runner_2';

  const mockState: LiveGameState = {
    gameId: 'game_xyz',
    code: 'MH84X9',
    name: 'Central Park Pursuit',
    hostId: chaserUser,
    status: 'running',
    settings: {
      zone: { center: { latitude: 40.78, longitude: -73.96 }, radius: 1000 },
      noGoZones: [],
      durationMin: 60,
      headStartMin: 3,
      revealIntervalMin: 2,
      revealMode: 'RUNNERS_TO_CHASERS',
      zoneShrink: { startAfterMin: 30, percent: 25, count: 3 },
      tagMethod: 'CODE',
      outOfZonePenalty: 'WARNING',
      teamVisibility: 'TEAMMATES_ONLY',
    },
    players: [
      { userId: chaserUser, username: 'chaser_alpha', role: 'CHASER', status: 'ACTIVE', ready: true, isHost: true },
      { userId: runner1User, username: 'runner_ghost', role: 'RUNNER', status: 'ACTIVE', ready: true },
      { userId: runner2User, username: 'runner_shadow', role: 'RUNNER', status: 'ACTIVE', ready: true },
    ],
    shrinkStage: 0,
    currentZone: { center: { latitude: 40.78, longitude: -73.96 }, radius: 1000 },
    locations: new Map([
      [
        chaserUser,
        {
          userId: chaserUser,
          username: 'chaser_alpha',
          role: 'CHASER',
          coordinates: { latitude: 40.7801, longitude: -73.9601 },
          timestamp: 1000,
        },
      ],
      [
        runner1User,
        {
          userId: runner1User,
          username: 'runner_ghost',
          role: 'RUNNER',
          coordinates: { latitude: 40.7850, longitude: -73.9650 },
          timestamp: 1000,
        },
      ],
      [
        runner2User,
        {
          userId: runner2User,
          username: 'runner_shadow',
          role: 'RUNNER',
          coordinates: { latitude: 40.7860, longitude: -73.9660 },
          timestamp: 1000,
        },
      ],
    ]),
    runnerSnapshots: [
      {
        userId: runner1User,
        username: 'runner_ghost',
        coordinates: { latitude: 40.7840, longitude: -73.9640 },
        timestamp: 800, // snapshot from previous reveal tick
      },
    ],
    tagCodes: new Map(),
  };

  // 1. Chaser view filter
  const chaserSync = filterStateForPlayer(mockState, chaserUser);

  // Teammates in chaser's view must ONLY contain other chasers (or self)
  assert.equal(chaserSync.teammateLocations.length, 1);
  assert.equal(chaserSync.teammateLocations[0].userId, chaserUser);

  // Verify NO runner live locations are present in chaser's payload
  const leakedRunner = chaserSync.teammateLocations.find((l) => l.role === 'RUNNER');
  assert.equal(leakedRunner, undefined, 'CRITICAL: Runner live location leaked to chaser!');

  // Verify chaser DOES receive the periodic runner snapshot
  assert.equal(chaserSync.runnerSnapshots.length, 1);
  assert.equal(chaserSync.runnerSnapshots[0].userId, runner1User);
  assert.equal(chaserSync.runnerSnapshots[0].coordinates.latitude, 40.7840);

  // 2. Runner view filter
  const runnerSync = filterStateForPlayer(mockState, runner1User);

  // Runner view must contain runner teammates only
  assert.equal(runnerSync.teammateLocations.length, 2);
  assert.ok(runnerSync.teammateLocations.every((l) => l.role === 'RUNNER'));
  assert.equal(runnerSync.teammateLocations.some((l) => l.role === 'CHASER'), false);

  // 3. Socket direct delivery check
  assert.equal(canReceiveLiveLocation(mockState, runner1User, chaserUser), false);
  assert.equal(canReceiveLiveLocation(mockState, runner1User, runner2User), true);
  assert.equal(canReceiveLiveLocation(mockState, chaserUser, runner1User), false);
});
