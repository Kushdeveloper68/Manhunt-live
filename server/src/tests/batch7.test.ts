import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { SOCKET_EVENTS, LivePlayerLocation } from '@manhunt/shared';
import {
  judgeLocation,
  EventRateLimiter,
  MOCK_STRIKES_TO_REMOVE,
  TELEPORT_STRIKES_TO_REMOVE,
} from '../game/antiCheat.js';
import { gameStateStore, LiveGameState } from '../game/gameStateStore.js';
import { gameLoopManager } from '../game/gameLoop.js';
import { registerLocationHandlers } from '../socket/locationHandler.js';
import { registerLobbyHandlers } from '../socket/lobbyHandler.js';
import { createApp } from '../app.js';
import { generateToken } from '../utils/auth.js';

const A = { latitude: 23.0225, longitude: 72.5714 };
const north = (m: number) => ({ latitude: A.latitude + m / 111_320, longitude: A.longitude });

const fix = (coords = A, over: Partial<LivePlayerLocation> = {}, at = 1_000_000): LivePlayerLocation => ({
  userId: 'r1',
  username: 'r1',
  role: 'RUNNER',
  coordinates: coords,
  timestamp: at,
  receivedAt: at,
  ...over,
});

// ───────── pure judging ─────────
test('MOCK GPS: warned twice, removed on the third strike, fixes are never accepted', () => {
  let rec = { mock: 0, jumps: 0 };
  const verdicts = [];
  for (let i = 0; i < MOCK_STRIKES_TO_REMOVE; i++) {
    const v = judgeLocation(undefined, fix(A, { isMock: true }), rec, 1_000_000 + i * 1000);
    verdicts.push(v);
    rec = v.record;
  }
  assert.ok(verdicts.every((v) => !v.accept));
  assert.deepEqual(verdicts.map((v) => v.warn), [true, true, false]);
  assert.deepEqual(verdicts.map((v) => v.remove), [false, false, true]);
});

test('a normal walking fix is accepted and resets the teleport counter', () => {
  const prev = fix(A);
  const v = judgeLocation(prev, fix(north(3), {}, 1_001_000), { mock: 0, jumps: 4 }, 1_001_000);
  assert.equal(v.accept, true);
  assert.equal(v.record.jumps, 0);
});

test('TELEPORT: one GPS glitch is rejected but never removes anyone', () => {
  const v = judgeLocation(fix(A), fix(north(900), {}, 1_001_000), { mock: 0, jumps: 0 }, 1_001_000);
  assert.equal(v.accept, false);
  assert.equal(v.kind, 'TELEPORT');
  assert.equal(v.remove, false);
  const next = judgeLocation(fix(A), fix(north(3), {}, 1_002_000), v.record, 1_002_000);
  assert.equal(next.accept, true, 'the next normal fix is accepted');
  assert.equal(next.record.jumps, 0);
});

test('TELEPORT: a sustained run of impossible jumps removes the player (warned halfway)', () => {
  let rec = { mock: 0, jumps: 0 };
  const results = [];
  for (let i = 1; i <= TELEPORT_STRIKES_TO_REMOVE; i++) {
    const v = judgeLocation(fix(A), fix(north(2000), {}, 1_000_000 + i * 1000), rec, 1_000_000 + i * 1000);
    results.push(v);
    rec = v.record;
  }
  assert.equal(results.filter((v) => v.warn).length, 1);
  assert.equal(results[results.length - 1].remove, true);
  assert.equal(results[results.length - 2].remove, false);
});

test('small GPS noise is never judged, and a long gap makes a big move legitimate', () => {
  assert.equal(judgeLocation(fix(A), fix(north(40), {}, 1_000_500), { mock: 0, jumps: 0 }, 1_000_500).accept, true);
  assert.equal(judgeLocation(fix(A), fix(north(900), {}, 1_120_000), { mock: 0, jumps: 0 }, 1_120_000).accept, true, '2 min gap = 7.5 m/s');
});

test('flood protection: drops excess events, disconnects persistent offenders', () => {
  const lim = new EventRateLimiter(5, 1000, 3);
  const out = [];
  for (let i = 0; i < 12; i++) out.push(lim.hit(1000 + i));
  assert.deepEqual(out.slice(0, 5), ['ok', 'ok', 'ok', 'ok', 'ok']);
  assert.equal(out[5], 'drop');
  assert.ok(out.includes('disconnect'));
  assert.equal(lim.hit(5000), 'ok', 'recovers after the window');
});

// ───────── through the socket handlers ─────────
function mkSock(userId: string) {
  const handlers: Record<string, (p: unknown) => Promise<void>> = {};
  const emitted: [string, any][] = [];
  return {
    data: { user: { userId, username: userId } },
    handlers,
    emitted,
    on: (e: string, fn: (p: unknown) => Promise<void>) => (handlers[e] = fn),
    emit: (e: string, p: any) => emitted.push([e, p]),
    join: () => {},
    leave: () => {},
  };
}

function state(id: string): LiveGameState {
  return {
    gameId: id,
    code: id.toUpperCase(),
    name: 'T',
    hostId: 'host',
    status: 'running',
    settings: {
      zone: { center: A, radius: 5000 },
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
      { userId: 'r1', username: 'runner1', role: 'RUNNER', status: 'ACTIVE', ready: true },
      { userId: 'r2', username: 'runner2', role: 'RUNNER', status: 'ACTIVE', ready: true },
    ],
    shrinkStage: 0,
    currentZone: { center: A, radius: 5000 },
    locations: new Map(),
    runnerSnapshots: [],
    tagCodes: new Map(),
    startedAt: Date.now() - 1000,
  };
}

async function world(id: string) {
  const st = state(id);
  await gameStateStore.set(id, st);
  const host = mkSock('host');
  const r1 = mkSock('r1');
  const r2 = mkSock('r2');
  const all = [host, r1, r2];
  const roomEmits: [string, any][] = [];
  const byId = new Map<string, any>(all.map((s, i) => [`s${i}`, s]));
  const io: any = {
    sockets: { adapter: { rooms: new Map([[`game:${id}`, new Set(byId.keys())]]) }, sockets: byId },
    to: () => ({ emit: (e: string, p: any) => roomEmits.push([e, p]) }),
    in: () => ({ socketsLeave: () => {} }),
  };
  (gameLoopManager as any).io = io;
  for (const s of all) {
    registerLocationHandlers(io, s as any);
    registerLobbyHandlers(io, s as any);
  }
  return { st, host, r1, r2, roomEmits };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('HANDLER: mock-GPS fixes are never stored; after 3 strikes the player is removed and the host told', async () => {
  const { st, host, r1 } = await world('fpA');
  const send = (isMock: boolean) =>
    r1.handlers[SOCKET_EVENTS.LOCATION_UPDATE]({ gameId: 'fpA', coordinates: A, accuracy: 5, isMock, timestamp: Date.now() });

  await send(true);
  assert.equal(st.locations.has('r1'), false, 'a mock fix is not stored');
  assert.equal(r1.emitted.filter(([e]) => e === SOCKET_EVENTS.FAIR_PLAY_WARNING).length, 1);

  await wait(950);
  await send(true);
  await wait(950);
  await send(true);

  const p = st.players.find((x) => x.userId === 'r1')!;
  assert.equal(p.status, 'ELIMINATED');
  assert.equal(p.taggedBy, 'FAIR PLAY');
  assert.equal(host.emitted.filter(([e]) => e === SOCKET_EVENTS.FAIR_PLAY_ALERT).length, 1);
});

test('HANDLER: honest fixes are unaffected', async () => {
  const { st, r1 } = await world('fpB');
  await r1.handlers[SOCKET_EVENTS.LOCATION_UPDATE]({ gameId: 'fpB', coordinates: A, accuracy: 5, isMock: false, timestamp: Date.now() });
  assert.equal(st.locations.has('r1'), true);
  assert.equal(st.players.find((x) => x.userId === 'r1')!.status, 'ACTIVE');
});

test('HOST REMOVE: the host can remove a player mid-match; others cannot; the host cannot remove themself', async () => {
  const { st, host, r1, r2 } = await world('kickA');
  await r2.handlers[SOCKET_EVENTS.PLAYER_KICK]({ gameId: 'kickA', targetUserId: 'r1' });
  assert.equal(st.players.find((x) => x.userId === 'r1')!.status, 'ACTIVE', 'non-host refused');
  assert.equal(r2.emitted.filter(([e]) => e === SOCKET_EVENTS.ERROR).length, 1);

  await host.handlers[SOCKET_EVENTS.PLAYER_KICK]({ gameId: 'kickA', targetUserId: 'host' });
  assert.equal(host.emitted.filter(([e]) => e === SOCKET_EVENTS.ERROR).length, 1);

  await host.handlers[SOCKET_EVENTS.PLAYER_KICK]({ gameId: 'kickA', targetUserId: 'r1' });
  const p = st.players.find((x) => x.userId === 'r1')!;
  assert.equal(p.status, 'ELIMINATED');
  assert.equal(p.taggedBy, 'HOST');
});

// ───────── reports API (validation + auth, no DB needed) ─────────
async function withServer(fn: (base: string) => Promise<void>) {
  const server = http.createServer(createApp());
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as any;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}
const bearer = () => ({
  Authorization: `Bearer ${generateToken({ _id: '507f1f77bcf86cd799439011', email: 'a@b.co', username: 'tester' } as any)}`,
  'Content-Type': 'application/json',
});

test('REPORTS: need login, a real reason and valid ids; you cannot report yourself', async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/api/reports`, { method: 'POST' })).status, 401);
    const post = (body: unknown) => fetch(`${base}/api/reports`, { method: 'POST', headers: bearer(), body: JSON.stringify(body) });
    assert.equal((await post({ reportedUserId: 'bad', reason: 'CHEATING' })).status, 400);
    assert.equal((await post({ reportedUserId: '507f1f77bcf86cd799439012', reason: 'BORED' })).status, 400);
    assert.equal((await post({ reportedUserId: '507f1f77bcf86cd799439011', reason: 'CHEATING' })).status, 400, 'self-report');
    assert.equal((await post({ reportedUserId: '507f1f77bcf86cd799439012', reason: 'CHEATING', details: 'x'.repeat(301) })).status, 400);
  });
});
