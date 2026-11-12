import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { createApp } from '../app.js';
import { generateToken } from '../utils/auth.js';
import {
  pairKey,
  decideFriendRequest,
  relationshipOf,
  deriveFriendStatus,
  lastSeenLabel,
  escapeRegex,
} from '../game/friendRules.js';
import { buildMatchSummary, computeStatDeltas, plausibleStepMeters } from '../game/matchSummary.js';
import { buildPushMessages, isValidPushToken, sendPushToUsers, setPushSender } from '../services/push.js';
import { User } from '../models/User.js';
import { gameLoopManager } from '../game/gameLoop.js';
import { gameStateStore, LiveGameState } from '../game/gameStateStore.js';
import { registerLocationHandlers } from '../socket/locationHandler.js';

// ───────────────────────── friend rules ─────────────────────────
test('pairKey is order independent (A->B and B->A are the same friendship)', () => {
  assert.equal(pairKey('a', 'b'), pairKey('b', 'a'));
  assert.notEqual(pairKey('a', 'b'), pairKey('a', 'c'));
});

test('decideFriendRequest covers every case', () => {
  assert.equal(decideFriendRequest('me', 'me', null).action, 'REJECT');
  assert.equal(decideFriendRequest('me', 'u', null).action, 'CREATE');
  assert.equal(decideFriendRequest('me', 'u', { requester: 'u', recipient: 'me', status: 'PENDING' }).action, 'AUTO_ACCEPT');
  assert.equal(decideFriendRequest('me', 'u', { requester: 'me', recipient: 'u', status: 'PENDING' }).action, 'REJECT');
  assert.equal(decideFriendRequest('me', 'u', { requester: 'u', recipient: 'me', status: 'ACCEPTED' }).action, 'REJECT');
});

test('relationshipOf describes the pair from my point of view', () => {
  assert.equal(relationshipOf('me', null), 'NONE');
  assert.equal(relationshipOf('me', { requester: 'me', recipient: 'u', status: 'PENDING' }), 'REQUEST_SENT');
  assert.equal(relationshipOf('me', { requester: 'u', recipient: 'me', status: 'PENDING' }), 'REQUEST_RECEIVED');
  assert.equal(relationshipOf('me', { requester: 'u', recipient: 'me', status: 'ACCEPTED' }), 'FRIEND');
});

test('friend status precedence: in game > in lobby > online > offline', () => {
  assert.equal(deriveFriendStatus({ online: true, inGame: true, lobbyName: 'x' }).status, 'IN_GAME');
  assert.equal(deriveFriendStatus({ online: true, inGame: false, lobbyName: 'Central Park' }).statusDetail, 'IN LOBBY: CENTRAL PARK');
  assert.equal(deriveFriendStatus({ online: true, inGame: false }).status, 'ONLINE');
  assert.equal(deriveFriendStatus({ online: false, inGame: false }).status, 'OFFLINE');
});

test('lastSeenLabel and regex escaping', () => {
  const now = Date.now();
  assert.equal(lastSeenLabel(undefined, now), undefined);
  assert.equal(lastSeenLabel(new Date(now - 2 * 3600_000), now), '2H AGO');
  assert.equal(lastSeenLabel(new Date(now - 30 * 3600_000), now), 'YESTERDAY');
  // username search must not allow regex injection
  const re = new RegExp(`^${escapeRegex('.*')}`);
  assert.equal(re.test('anything'), false);
});

// ───────────────────────── match summary / stats ─────────────────────────
const players = [
  { userId: 'c1', username: 'chaser1', role: 'CHASER', status: 'ACTIVE' },
  { userId: 'c2', username: 'chaser2', role: 'CHASER', status: 'ACTIVE' },
  { userId: 'r1', username: 'runner1', role: 'RUNNER', status: 'ELIMINATED', taggedBy: 'chaser1' },
  { userId: 'r2', username: 'runner2', role: 'RUNNER', status: 'ELIMINATED', taggedBy: 'chaser1' },
  { userId: 'r3', username: 'runner3', role: 'RUNNER', status: 'ELIMINATED', taggedBy: 'ZONE BREACH' },
  { userId: 'r4', username: 'runner4', role: 'RUNNER', status: 'ACTIVE' },
];

test('match summary counts tags per chaser and ignores zone-breach eliminations', () => {
  const s = buildMatchSummary(
    { players, distanceMeters: new Map([['r4', 2500]]), startedAt: 0, endedAt: 30 * 60000 },
    'RUNNER'
  );
  assert.equal(s.players.find((p) => p.userId === 'c1')!.tags, 2);
  assert.equal(s.players.find((p) => p.userId === 'c2')!.tags, 0);
  assert.equal(s.players.find((p) => p.userId === 'r4')!.survived, true);
  assert.equal(s.players.find((p) => p.userId === 'r4')!.distanceKm, 2.5);
  assert.equal(s.durationMin, 30);
  assert.ok(s.mvpUserId);
});

test('stat deltas: wins go to the winning role, escapes only to surviving runners', () => {
  const s = buildMatchSummary({ players }, 'RUNNER');
  const d = computeStatDeltas(s);
  assert.equal(d.get('r4')!.wins, 1);
  assert.equal(d.get('r4')!.escapes, 1);
  assert.equal(d.get('r1')!.escapes, 0);
  assert.equal(d.get('c1')!.wins, 0);
  assert.equal(d.get('c1')!.tags, 2);
  assert.equal(d.get('c1')!.games, 1);
});

test('distance counting ignores mock GPS, jitter, bad accuracy and vehicle-speed jumps', () => {
  assert.equal(plausibleStepMeters(8, 1000, false, 10), 8);
  assert.equal(plausibleStepMeters(8, 1000, true, 10), 0);
  assert.equal(plausibleStepMeters(1, 1000, false, 10), 0);
  assert.equal(plausibleStepMeters(8, 1000, false, 200), 0);
  assert.equal(plausibleStepMeters(500, 1000, false, 10), 0);
});

// ───────────────────────── endGame integration ─────────────────────────
function baseState(id: string): LiveGameState {
  const c = { latitude: 40, longitude: -73 };
  return {
    gameId: id,
    code: id.toUpperCase(),
    name: 'T',
    hostId: 'c1',
    status: 'running',
    settings: {
      zone: { center: c, radius: 1000 },
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
    players: players.map((p) => ({ ...p, ready: true })) as any,
    shrinkStage: 0,
    currentZone: { center: c, radius: 1000 },
    locations: new Map(),
    runnerSnapshots: [],
    tagCodes: new Map(),
    startedAt: Date.now() - 600000,
  };
}

test('endGame attaches a summary to GAME_END and is idempotent', async () => {
  const roomEmits: [string, any][] = [];
  (gameLoopManager as any).io = {
    sockets: { adapter: { rooms: new Map() }, sockets: new Map() },
    to: () => ({ emit: (e: string, p: any) => roomEmits.push([e, p]) }),
  };
  const state = baseState('endA');
  await gameStateStore.set('endA', state);

  await gameLoopManager.endGame(state, 'RUNNER', 'SURVIVED');
  await gameLoopManager.endGame(state, 'CHASER', 'again'); // must be ignored

  const ends = roomEmits.filter(([e]) => e === SOCKET_EVENTS.GAME_END);
  assert.equal(ends.length, 1);
  assert.equal(ends[0][1].winningRole, 'RUNNER');
  assert.ok(Array.isArray(ends[0][1].summary.players));
  assert.equal(state.winnerRole, 'RUNNER');
});

// ───────────────────────── live location privacy + distance ─────────────────────────
test('location updates reach teammates only, and distance is accumulated server-side', async () => {
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
  const runner1 = mk('r1');
  const runner4 = mk('r4');
  const chaser = mk('c1');
  const byId = new Map<string, any>([['a', runner1], ['b', runner4], ['c', chaser]]);
  const io: any = {
    sockets: { adapter: { rooms: new Map([['game:locA', new Set(byId.keys())]]) }, sockets: byId },
    to: () => ({ emit: () => {} }),
  };
  const state = baseState('locA');
  state.players.find((p) => p.userId === 'r1')!.status = 'ACTIVE';
  await gameStateStore.set('locA', state);
  registerLocationHandlers(io, runner1 as any);

  const send = (lat: number) =>
    runner1.handlers[SOCKET_EVENTS.LOCATION_UPDATE]({
      gameId: 'locA',
      coordinates: { latitude: lat, longitude: -73 },
      accuracy: 5,
      timestamp: Date.now(),
    });

  await send(40.0);
  await new Promise((r) => setTimeout(r, 1000)); // rate limiter allows 1 update / 900 ms
  await send(40.00007); // ~7.8 m north

  const locEvents = (s: ReturnType<typeof mk>) => s.emitted.filter(([e]) => e === SOCKET_EVENTS.LOCATION_UPDATE).length;
  assert.equal(locEvents(chaser), 0, 'a chaser must never receive a runner live location');
  assert.equal(locEvents(runner4), 2, 'teammates receive live updates');
  const meters = state.distanceMeters?.get('r1') ?? 0;
  assert.ok(meters > 5 && meters < 12, `expected ~8 m, got ${meters}`);
  await gameLoopManager.endGame(state, 'RUNNER', 'done'); // clears timers
});

// ───────────────────────── push service ─────────────────────────
test('push: only valid Expo tokens are used, duplicates removed', () => {
  assert.equal(isValidPushToken('ExponentPushToken[abc123]'), true);
  assert.equal(isValidPushToken('random'), false);
  const msgs = buildPushMessages(['ExponentPushToken[a]', 'ExponentPushToken[a]', 'nope'], { title: 't', body: 'b' });
  assert.equal(msgs.length, 1);
});

test('push: sends to users with tokens, and a failing sender never throws', async () => {
  const sent: any[] = [];
  setPushSender(async (m) => {
    sent.push(...m);
  });
  const realFind = (User as any).find;
  (User as any).find = () => ({ select: async () => [{ pushToken: 'ExponentPushToken[user1]' }] });
  try {
    await sendPushToUsers(['507f1f77bcf86cd799439011'], { title: 'Hi', body: 'There' });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'ExponentPushToken[user1]');

    setPushSender(async () => {
      throw new Error('network down');
    });
    await sendPushToUsers(['507f1f77bcf86cd799439011'], { title: 'Hi', body: 'There' }); // must not throw
    await sendPushToUsers(['not-an-object-id'], { title: 'x', body: 'y' }); // ignored
  } finally {
    (User as any).find = realFind;
    setPushSender(null);
  }
});

// ───────────────────────── HTTP guards / validation (no DB needed) ─────────────────────────
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

test('friends API requires authentication', async () => {
  await withServer(async (base) => {
    for (const path of ['/api/friends', '/api/friends/search?q=ab', '/api/friends/invites']) {
      const res = await fetch(base + path);
      assert.equal(res.status, 401, path);
    }
  });
});

test('friends API validates input before touching the database', async () => {
  await withServer(async (base) => {
    const search = await fetch(`${base}/api/friends/search?q=a`, { headers: bearer() });
    assert.equal(search.status, 400);
    const request = await fetch(`${base}/api/friends/request`, { method: 'POST', headers: bearer(), body: JSON.stringify({ username: 'x' }) });
    assert.equal(request.status, 400);
    const invite = await fetch(`${base}/api/friends/invite`, { method: 'POST', headers: bearer(), body: JSON.stringify({ gameId: 'bad', userId: 'bad' }) });
    assert.equal(invite.status, 400);
    const accept = await fetch(`${base}/api/friends/requests/not-an-id/accept`, { method: 'POST', headers: bearer() });
    assert.equal(accept.status, 400);
  });
});

test('push-token and delete-account endpoints validate input', async () => {
  await withServer(async (base) => {
    const bad = await fetch(`${base}/api/auth/push-token`, { method: 'PUT', headers: bearer(), body: JSON.stringify({ token: 'not-a-token' }) });
    assert.equal(bad.status, 400);
    const noConfirm = await fetch(`${base}/api/auth/me`, { method: 'DELETE', headers: bearer(), body: JSON.stringify({}) });
    assert.equal(noConfirm.status, 400);
    const anon = await fetch(`${base}/api/auth/me`, { method: 'DELETE' });
    assert.equal(anon.status, 401);
  });
});
