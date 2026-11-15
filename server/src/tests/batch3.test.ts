import test from 'node:test';
import assert from 'node:assert/strict';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { toGameListItem } from '../utils/gameList.js';
import { staleLobbyCutoff, STALE_LOBBY_MS } from '../services/cleanup.js';
import { gameStateStore, LiveGameState } from '../game/gameStateStore.js';
import { gameLoopManager, HOST_TRANSFER_AFTER_MS, OFFLINE_ELIMINATION_AFTER_MS } from '../game/gameLoop.js';
import { filterStateForPlayer } from '../game/visibility.js';
import { registerLobbyHandlers } from '../socket/lobbyHandler.js';
import { setPresenceIo } from '../socket/presence.js';

// ───────── list items ─────────
const baseGame = (over: any = {}) => ({
  _id: 'g1',
  code: 'ABC123',
  name: 'Night Hunt',
  status: 'ended',
  hostId: { _id: 'u1', username: 'hosty' },
  players: [
    { userId: { _id: 'u1' }, role: 'CHASER' },
    { userId: { _id: 'u2' }, role: 'RUNNER' },
  ],
  createdAt: new Date('2026-11-01T10:00:00Z'),
  startedAt: new Date('2026-11-01T10:05:00Z'),
  endedAt: new Date('2026-11-01T10:50:00Z'),
  result: { winningRole: 'RUNNER', summary: { players: [{ userId: 'u2', tags: 0, distanceKm: 3.2, survived: true }] } },
  ...over,
});

test('list item: a finished match shows my role, win/loss, duration and my stats', () => {
  const runner = toGameListItem(baseGame(), 'u2');
  assert.equal(runner.role, 'RUNNER');
  assert.equal(runner.won, true);
  assert.equal(runner.durationMin, 45);
  assert.deepEqual(runner.stats, { tags: 0, distanceKm: 3.2, survived: true });
  assert.equal(toGameListItem(baseGame(), 'u1').won, false);
  assert.equal(runner.hostUsername, 'hosty');
});

test('list item: cancelled matches have no winner and are flagged', () => {
  const item = toGameListItem(baseGame({ result: { reason: 'CANCELLED_BY_HOST' } }), 'u2');
  assert.equal(item.cancelled, true);
  assert.equal(item.won, null);
});

test('list item: an active lobby is not cancelled and has no result yet', () => {
  const item = toGameListItem(baseGame({ status: 'lobby', endedAt: undefined, startedAt: undefined, result: undefined }), 'u2');
  assert.equal(item.cancelled, false);
  assert.equal(item.won, null);
  assert.equal(item.durationMin, undefined);
});

test('stale lobby cutoff is 3 hours back', () => {
  const now = 1_000_000_000_000;
  assert.equal(staleLobbyCutoff(now).getTime(), now - STALE_LOBBY_MS);
  assert.equal(STALE_LOBBY_MS, 3 * 3600 * 1000);
});

// ───────── ended match: late players still get the result ─────────
const C = { latitude: 23.0225, longitude: 72.5714 };
function liveState(id: string): LiveGameState {
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
    ],
    shrinkStage: 0,
    currentZone: { center: C, radius: 1000 },
    locations: new Map(),
    runnerSnapshots: [],
    tagCodes: new Map(),
    startedAt: Date.now() - 1000,
  };
}

test('ended match: the synced state carries the result, so a late rejoin can show the summary', async () => {
  (gameLoopManager as any).io = { sockets: { adapter: { rooms: new Map() }, sockets: new Map() }, to: () => ({ emit: () => {} }) };
  const st = liveState('endR');
  await gameStateStore.set('endR', st);
  await gameLoopManager.endGame(st, 'CHASER', 'ELIMINATION');
  const view = filterStateForPlayer(st, 'r1');
  assert.equal(view.matchResult?.winningRole, 'CHASER');
  assert.ok(view.matchResult?.summary);
  assert.equal(filterStateForPlayer(liveState('x'), 'r1').matchResult, undefined);
});

// ───────── rejoin through the socket handler ─────────
function mkSock(userId: string) {
  const handlers: Record<string, (p: unknown) => Promise<void>> = {};
  const emitted: [string, any][] = [];
  const joined: string[] = [];
  return {
    data: { user: { userId, username: userId } },
    handlers,
    emitted,
    joined,
    on: (e: string, fn: (p: unknown) => Promise<void>) => (handlers[e] = fn),
    emit: (e: string, p: any) => emitted.push([e, p]),
    join: (room: string) => joined.push(room),
    leave: () => {},
  };
}

test('REJOIN: a player already in a running match gets THEIR filtered state and is put back in the room', async () => {
  const st = liveState('rejA');
  st.locations.set('r1', { userId: 'r1', username: 'runner1', role: 'RUNNER', coordinates: C, timestamp: Date.now(), receivedAt: Date.now() });
  st.tagCodes.set('r1', '4821');
  await gameStateStore.set('rejA', st);
  const runner = mkSock('r1');
  const io: any = { sockets: { adapter: { rooms: new Map() }, sockets: new Map() }, to: () => ({ emit: () => {} }), in: () => ({ socketsLeave: () => {} }) };
  registerLobbyHandlers(io, runner as any);

  await runner.handlers[SOCKET_EVENTS.GAME_JOIN]({ gameId: 'rejA' });

  assert.deepEqual(runner.joined, ['game:rejA']);
  const sync = runner.emitted.find(([e]) => e === SOCKET_EVENTS.GAME_STATE)![1];
  assert.equal(sync.status, 'running');
  const me = sync.players.find((p: any) => p.userId === 'r1');
  assert.equal(me.tagCode, '4821', 'the runner gets their own tag code back');
  assert.equal(sync.players.find((p: any) => p.userId === 'host').tagCode, undefined);
  assert.equal(sync.teammateLocations.length, 1);
});

// ───────── host transfer + ghost players ─────────
function presenceWith(online: string[]) {
  const rooms = new Map<string, Set<string>>(online.map((id) => [`user:${id}`, new Set(['s'])]));
  setPresenceIo({ sockets: { adapter: { rooms } }, to: () => ({ emit: () => {} }) } as any);
}

test('PRESENCE: when the host stays offline, the next online active player becomes host', async () => {
  (gameLoopManager as any).io = { sockets: { adapter: { rooms: new Map() }, sockets: new Map() }, to: () => ({ emit: () => {} }) };
  const st = liveState('hostA');
  await gameStateStore.set('hostA', st);
  presenceWith(['c2', 'r1']); // host is NOT online
  const t0 = Date.now();
  await gameLoopManager.managePresence(st, t0);
  assert.equal(st.hostId, 'host', 'not transferred straight away');
  await gameLoopManager.managePresence(st, t0 + HOST_TRANSFER_AFTER_MS + 1000);
  assert.equal(st.hostId, 'c2');
  assert.equal(st.players.find((p) => p.userId === 'c2')!.isHost, true);
  assert.equal(st.players.find((p) => p.userId === 'host')!.isHost, false);
});

test('PRESENCE: a player offline for too long is removed; a reconnecting one is not', async () => {
  (gameLoopManager as any).io = { sockets: { adapter: { rooms: new Map() }, sockets: new Map() }, to: () => ({ emit: () => {} }) };
  const st = liveState('ghostA');
  await gameStateStore.set('ghostA', st);
  presenceWith(['host', 'c2']); // r1 offline
  const t0 = Date.now();
  await gameLoopManager.managePresence(st, t0);
  await gameLoopManager.managePresence(st, t0 + OFFLINE_ELIMINATION_AFTER_MS - 1000);
  assert.equal(st.players.find((p) => p.userId === 'r1')!.status, 'ACTIVE', 'still within the grace period');

  presenceWith(['host', 'c2', 'r1']); // r1 is back
  await gameLoopManager.managePresence(st, t0 + OFFLINE_ELIMINATION_AFTER_MS + 5000);
  assert.equal(st.players.find((p) => p.userId === 'r1')!.status, 'ACTIVE');

  presenceWith(['host', 'c2']); // gone again, and stays gone
  const t1 = t0 + OFFLINE_ELIMINATION_AFTER_MS + 10_000;
  await gameLoopManager.managePresence(st, t1);
  await gameLoopManager.managePresence(st, t1 + OFFLINE_ELIMINATION_AFTER_MS + 1000);
  const r1 = st.players.find((p) => p.userId === 'r1')!;
  assert.equal(r1.status, 'ELIMINATED');
  assert.equal(r1.taggedBy, 'LEFT GAME');
});
