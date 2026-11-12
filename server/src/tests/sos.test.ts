import test from 'node:test';
import assert from 'node:assert/strict';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { gameStateStore, LiveGameState } from '../game/gameStateStore.js';
import { registerSafetyHandlers } from '../socket/safetyHandler.js';
import { registerLocationHandlers } from '../socket/locationHandler.js';

const C = { latitude: 40, longitude: -73 };

function state(id: string): LiveGameState {
  return {
    gameId: id,
    code: id.toUpperCase(),
    name: 'T',
    hostId: 'host',
    status: 'running',
    settings: {
      zone: { center: C, radius: 1000 },
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
      { userId: 'host', username: 'hosty', role: 'CHASER', status: 'ACTIVE', ready: true, isHost: true },
      { userId: 'c2', username: 'chaser2', role: 'CHASER', status: 'ACTIVE', ready: true },
      { userId: 'r1', username: 'runner1', role: 'RUNNER', status: 'ACTIVE', ready: true },
      { userId: 'r2', username: 'runner2', role: 'RUNNER', status: 'ACTIVE', ready: true },
    ],
    shrinkStage: 0,
    currentZone: { center: C, radius: 1000 },
    locations: new Map(),
    runnerSnapshots: [],
    tagCodes: new Map(),
  };
}

const mk = (userId: string) => {
  const handlers: Record<string, (p: unknown) => Promise<void>> = {};
  const emitted: [string, any][] = [];
  return {
    data: { user: { userId, username: userId } },
    handlers,
    emitted,
    on: (e: string, fn: (p: unknown) => Promise<void>) => (handlers[e] = fn),
    emit: (e: string, p: any) => emitted.push([e, p]),
  };
};
const got = (s: ReturnType<typeof mk>, ev: string) => s.emitted.filter(([e]) => e === ev);

async function setup(id: string) {
  const st = state(id);
  st.locations.set('r1', { userId: 'r1', username: 'runner1', role: 'RUNNER', coordinates: { latitude: 40.001, longitude: -73.001 }, timestamp: Date.now(), receivedAt: Date.now() });
  await gameStateStore.set(id, st);
  const host = mk('host');
  const chaser = mk('c2');
  const runner = mk('r1');
  const mate = mk('r2');
  const outsider = mk('stranger');
  const all = [host, chaser, runner, mate, outsider];
  const byId = new Map<string, any>(all.map((s, i) => [`s${i}`, s]));
  const io: any = {
    sockets: { adapter: { rooms: new Map([[`game:${id}`, new Set(['s0', 's1', 's2', 's3'])]]) }, sockets: byId },
    to: () => ({ emit: () => {} }),
  };
  for (const s of all) registerSafetyHandlers(io, s as any);
  registerLocationHandlers(io, runner as any);
  return { st, host, chaser, runner, mate, outsider, io };
}

test('SOS goes ONLY to the host: not to chasers, teammates or the room', async () => {
  const { host, chaser, mate, runner } = await setup('sosA');
  await runner.handlers[SOCKET_EVENTS.SOS_TRIGGER]({ gameId: 'sosA', reason: 'help' });
  assert.equal(got(host, SOCKET_EVENTS.SOS_TRIGGER).length, 1);
  assert.equal(got(chaser, SOCKET_EVENTS.SOS_TRIGGER).length, 0, 'chasers must never learn about a runner SOS');
  assert.equal(got(mate, SOCKET_EVENTS.SOS_TRIGGER).length, 0);
});

test('SOS uses the SERVER last-known location, not a forged client one', async () => {
  const { host, runner } = await setup('sosB');
  await runner.handlers[SOCKET_EVENTS.SOS_TRIGGER]({ gameId: 'sosB', coordinates: { latitude: 1, longitude: 1 } });
  const payload = got(host, SOCKET_EVENTS.SOS_TRIGGER)[0][1];
  assert.deepEqual(payload.coordinates, { latitude: 40.001, longitude: -73.001 });
});

test('SOS payload leaks no emergency contact or fake beacon URL', async () => {
  const { host, runner } = await setup('sosC');
  await runner.handlers[SOCKET_EVENTS.SOS_TRIGGER]({ gameId: 'sosC' });
  const payload = got(host, SOCKET_EVENTS.SOS_TRIGGER)[0][1];
  assert.equal('emergencyContact' in payload, false);
  assert.equal('liveBeaconUrl' in payload, false);
});

test('SOS sender gets an honest ack describing what actually happened', async () => {
  const { runner } = await setup('sosD');
  await runner.handlers[SOCKET_EVENTS.SOS_TRIGGER]({ gameId: 'sosD' });
  const ack = got(runner, SOCKET_EVENTS.SOS_ACK)[0][1];
  assert.equal(ack.hostNotified, true);
  assert.equal(ack.hasLocation, true);
});

test('SOS from someone who is not in the game is rejected (no spoofing)', async () => {
  const { host, outsider } = await setup('sosE');
  await outsider.handlers[SOCKET_EVENTS.SOS_TRIGGER]({ gameId: 'sosE' });
  assert.equal(got(host, SOCKET_EVENTS.SOS_TRIGGER).length, 0);
  assert.equal(got(outsider, SOCKET_EVENTS.ERROR).length, 1);
});

test('while SOS is active the host receives the sender live location; stops after resolve', async () => {
  const { host, runner } = await setup('sosF');
  await runner.handlers[SOCKET_EVENTS.SOS_TRIGGER]({ gameId: 'sosF' });
  await runner.handlers[SOCKET_EVENTS.LOCATION_UPDATE]({
    gameId: 'sosF',
    coordinates: { latitude: 40.002, longitude: -73.002 },
    accuracy: 5,
    timestamp: Date.now(),
  });
  assert.equal(got(host, SOCKET_EVENTS.SOS_LOCATION).length, 1);

  await runner.handlers[SOCKET_EVENTS.SOS_RESOLVED]({ gameId: 'sosF' });
  assert.equal(got(host, SOCKET_EVENTS.SOS_RESOLVED).length, 1);

  await new Promise((r) => setTimeout(r, 1000)); // location rate limit
  await runner.handlers[SOCKET_EVENTS.LOCATION_UPDATE]({
    gameId: 'sosF',
    coordinates: { latitude: 40.0021, longitude: -73.002 },
    accuracy: 5,
    timestamp: Date.now(),
  });
  assert.equal(got(host, SOCKET_EVENTS.SOS_LOCATION).length, 1, 'no more SOS location after resolve');
});
