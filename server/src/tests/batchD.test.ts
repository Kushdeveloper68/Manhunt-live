import test from 'node:test';
import assert from 'node:assert/strict';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { gameStateStore, LiveGameState } from '../game/gameStateStore.js';
import { gameLoopManager } from '../game/gameLoop.js';
import { registerLobbyHandlers } from '../socket/lobbyHandler.js';

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
      { userId: 'r1', username: 'runner1', role: 'RUNNER', status: 'ACTIVE', ready: true },
      { userId: 'r2', username: 'runner2', role: 'RUNNER', status: 'ACTIVE', ready: true },
    ],
    shrinkStage: 0,
    currentZone: { center: C, radius: 1000 },
    locations: new Map(),
    runnerSnapshots: [],
    tagCodes: new Map(),
    startedAt: Date.now() - 1000,
  };
}

const mk = (userId: string) => {
  const handlers: Record<string, (p: unknown) => Promise<void>> = {};
  const emitted: [string, any][] = [];
  return {
    data: { user: { userId, username: userId } },
    handlers,
    emitted,
    left: [] as string[],
    on(e: string, fn: (p: unknown) => Promise<void>) {
      handlers[e] = fn;
    },
    emit(e: string, p: any) {
      emitted.push([e, p]);
    },
    leave(room: string) {
      this.left.push(room);
    },
  };
};

async function setup(id: string) {
  const st = state(id);
  await gameStateStore.set(id, st);
  const host = mk('host');
  const r1 = mk('r1');
  const r2 = mk('r2');
  const all = [host, r1, r2];
  const roomEmits: [string, any][] = [];
  const left: string[] = [];
  const byId = new Map<string, any>(all.map((s, i) => [`s${i}`, s]));
  const io: any = {
    sockets: { adapter: { rooms: new Map([[`game:${id}`, new Set(byId.keys())]]) }, sockets: byId },
    to: () => ({ emit: (e: string, p: any) => roomEmits.push([e, p]) }),
    in: () => ({ socketsLeave: (room: string) => left.push(room) }),
  };
  (gameLoopManager as any).io = io;
  for (const s of all) registerLobbyHandlers(io, s as any);
  return { st, host, r1, r2, io, roomEmits, left };
}

test('LEAVE: a player who leaves a running match is removed so the match can still end', async () => {
  const { st, r1 } = await setup('leaveA');
  await r1.handlers[SOCKET_EVENTS.GAME_LEAVE]({ gameId: 'leaveA' });
  const p = st.players.find((x) => x.userId === 'r1')!;
  assert.equal(p.status, 'ELIMINATED');
  assert.equal(p.taggedBy, 'LEFT GAME');
  assert.deepEqual(r1.left, ['game:leaveA']);
  assert.equal(st.players.find((x) => x.userId === 'r2')!.status, 'ACTIVE');
});

test('LEAVE: when the last runner leaves, the chasers win on the next tick', async () => {
  const { st, r1, r2, roomEmits } = await setup('leaveB');
  await r1.handlers[SOCKET_EVENTS.GAME_LEAVE]({ gameId: 'leaveB' });
  await r2.handlers[SOCKET_EVENTS.GAME_LEAVE]({ gameId: 'leaveB' });
  await (gameLoopManager as any).processGame(st, Date.now());
  assert.equal(st.status, 'ended');
  assert.equal(st.winnerRole, 'CHASER');
  assert.ok(roomEmits.some(([e]) => e === SOCKET_EVENTS.GAME_END));
});

test('CANCEL: only the host can cancel a running match', async () => {
  const { st, r1, roomEmits } = await setup('cancelA');
  await r1.handlers[SOCKET_EVENTS.GAME_CANCEL]({ gameId: 'cancelA' });
  assert.equal(st.status, 'running');
  assert.equal(roomEmits.filter(([e]) => e === SOCKET_EVENTS.GAME_CANCELLED).length, 0);
  assert.equal(r1.emitted.filter(([e]) => e === SOCKET_EVENTS.ERROR).length, 1);
});

test('CANCEL: host cancel ends the match for everyone with NO winner and NO stats', async () => {
  const { st, host, roomEmits, left } = await setup('cancelB');
  await host.handlers[SOCKET_EVENTS.GAME_CANCEL]({ gameId: 'cancelB' });
  assert.equal(st.status, 'ended');
  assert.equal(st.summary, undefined, 'a cancelled match must not produce a result summary');
  assert.equal(st.winnerRole, undefined);
  assert.equal(roomEmits.filter(([e]) => e === SOCKET_EVENTS.GAME_CANCELLED).length, 1);
  assert.equal(roomEmits.filter(([e]) => e === SOCKET_EVENTS.GAME_END).length, 0);
  assert.deepEqual(left, ['game:cancelB']);
});

test('CANCEL: cancelling twice is harmless', async () => {
  const { host, roomEmits } = await setup('cancelC');
  await host.handlers[SOCKET_EVENTS.GAME_CANCEL]({ gameId: 'cancelC' });
  await host.handlers[SOCKET_EVENTS.GAME_CANCEL]({ gameId: 'cancelC' });
  assert.equal(roomEmits.filter(([e]) => e === SOCKET_EVENTS.GAME_CANCELLED).length, 1);
});
