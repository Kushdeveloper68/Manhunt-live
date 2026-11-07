import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPointInPolygon,
  checkNoGoZoneBreach,
  calculateBearing,
  getCardinalDirection,
  evaluateOutOfZonePenalty,
} from '../game/safety.js';
import { Coordinates, NoGoZone } from '@manhunt/shared';

test('isPointInPolygon detects containment inside complex polygon', () => {
  // Triangular no-go zone around a train yard
  const triangle: Coordinates[] = [
    { latitude: 40.75, longitude: -73.99 },
    { latitude: 40.76, longitude: -73.98 },
    { latitude: 40.74, longitude: -73.98 },
  ];

  // Center of triangle: inside
  const insidePoint = { latitude: 40.75, longitude: -73.985 };
  assert.equal(isPointInPolygon(insidePoint, triangle), true);

  // Far away point: outside
  const outsidePoint = { latitude: 40.80, longitude: -73.95 };
  assert.equal(isPointInPolygon(outsidePoint, triangle), false);
});

test('checkNoGoZoneBreach returns zone metadata on perimeter intrusion', () => {
  const metroTransitZone: NoGoZone = {
    id: 'metro-yard-01',
    name: 'METRO RAIL YARD',
    polygon: [
      { latitude: 40.75, longitude: -73.99 },
      { latitude: 40.76, longitude: -73.98 },
      { latitude: 40.74, longitude: -73.98 },
    ],
  };

  const insideCoords = { latitude: 40.75, longitude: -73.985 };
  const safeCoords = { latitude: 40.78, longitude: -73.96 };

  const breach = checkNoGoZoneBreach(insideCoords, [metroTransitZone]);
  assert.equal(breach.inViolation, true);
  assert.equal(breach.zoneName, 'METRO RAIL YARD');
  assert.equal(breach.zoneId, 'metro-yard-01');

  const safe = checkNoGoZoneBreach(safeCoords, [metroTransitZone]);
  assert.equal(safe.inViolation, false);
});

test('calculateBearing and cardinal directions calculate vector to safety correctly', () => {
  const fromPoint = { latitude: 40.78, longitude: -73.96 }; // Start

  // Point due North
  const northPoint = { latitude: 40.79, longitude: -73.96 };
  const northBearing = calculateBearing(fromPoint, northPoint);
  assert.ok(northBearing >= 355 || northBearing <= 5, `Expected ~0/360, got ${northBearing}`);
  assert.equal(getCardinalDirection(northBearing), 'NORTH');

  // Point South-West
  const swPoint = { latitude: 40.77, longitude: -73.975 };
  const swBearing = calculateBearing(fromPoint, swPoint);
  assert.equal(getCardinalDirection(swBearing), 'SOUTH-WEST');
});

test('evaluateOutOfZonePenalty applies host-selected rule correctly', () => {
  // 1. WARNING rule: always warns, never eliminates
  const warnCheck = evaluateOutOfZonePenalty('WARNING', 45, 120);
  assert.equal(warnCheck.action, 'WARNING');
  assert.match(warnCheck.message, /120M past perimeter/);

  // 2. REVEAL rule: warns during 30s grace, reveals after 30s
  const revealGrace = evaluateOutOfZonePenalty('REVEAL', 10, 80);
  assert.equal(revealGrace.action, 'WARNING');
  assert.equal(revealGrace.countdownSec, 20);

  const revealExceeded = evaluateOutOfZonePenalty('REVEAL', 35, 80);
  assert.equal(revealExceeded.action, 'REVEAL');
  assert.equal(revealExceeded.countdownSec, 0);

  // 3. ELIMINATE rule: warns during grace, eliminates after 30s
  const elimGrace = evaluateOutOfZonePenalty('ELIMINATE', 15, 95);
  assert.equal(elimGrace.action, 'WARNING');
  assert.equal(elimGrace.countdownSec, 15);

  const elimExceeded = evaluateOutOfZonePenalty('ELIMINATE', 32, 95);
  assert.equal(elimExceeded.action, 'ELIMINATE');
  assert.equal(elimExceeded.countdownSec, 0);
  assert.match(elimExceeded.message, /Disqualified/);
});
