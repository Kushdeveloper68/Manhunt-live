import test from 'node:test';
import assert from 'node:assert/strict';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { gameStateStore, LiveGameState } from '../game/gameStateStore.js';
import { gameLoopManager } from '../game/gameLoop.js';

const C = { latitude: 23.0225, longitude: 72.5714 };

function mk(userId: string) {
  const emitted: [string, any][] = [];
  return { data: { user: { userId, username: userId } }, emitted, emit: (e: string, p: any) => emitted.push([e, p]) };
}

function baseState(id: string, now: number): LiveGameState {
  return {
    gameId: id,
    code: id.toUpperCase(),
    name: 'T',
    hostId: 'c1',
    status: 'running',
    settings: {
      zone: { center: C, radius: 1000 },
      noGoZones: [],
      durationMin: 60,
      headStartMin: 1,
      revealIntervalMin: 1,
      revealMode: 'RUNNERS_TO_CHASERS',
      zoneShrink: { startAfterMin: 1, percent: 25, count: 1 },
      tagMethod: 'CODE',
      outOfZonePenalty: 'WARNING',
      teamVisibility: 'TEAMMATES_ONLY',
    },
    players: [
      { userId: 'c1', username: 'chaser1', role: 'CHASER', status: 'ACTIVE', ready: true },
      { userId: 'r1', username: 'runner1', role: 'RUNNER', status: 'ACTIVE', ready: true },
    ],
    shrinkStage: 0,
    currentZone: { center: C, radius: 1000 },
    locations: new Map([
      ['r1', { userId: 'r1', username: 'runner1', role: 'RUNNER', coordinates: { latitude: 23.0230, longitude: 72.5720 }, timestamp: now, receivedAt: now }],
    ]),
    runnerSnapshots: [],
    tagCodes: new Map(),
    startedAt: now - 120_000,
    nextRevealAt: now - 1,
  } as LiveGameState;
}

test('REVEAL: chasers get runner positions; runners are told they were revealed but get NO positions', async () => {
  const now = Date.now();
  const chaser = mk('c1');
  const runner = mk('r1');
  const byId = new Map<string, any>([['a', chaser], ['b', runner]]);
  (gameLoopManager as any).io = {
    sockets: { adapter: { rooms: new Map([['game:revA', new Set(['a', 'b'])]]) }, sockets: byId },
    to: () => ({ emit: () => {} }),
  };
  const st = baseState('revA', now);
  await gameStateStore.set('revA', st);
  await (gameLoopManager as any).processGame(st, now);

  const chaserTick = chaser.emitted.find(([e]) => e === SOCKET_EVENTS.REVEAL_TICK)![1];
  assert.equal(chaserTick.snapshots.length, 1);
  assert.equal(chaserTick.snapshots[0].userId, 'r1');

  const runnerTick = runner.emitted.find(([e]) => e === SOCKET_EVENTS.REVEAL_TICK)![1];
  assert.deepEqual(runnerTick.snapshots, []);
  assert.equal(runnerTick.chaserSnapshots, undefined, 'no chaser positions unless BOTH_WAYS');
  assert.ok(runnerTick.nextRevealTimestamp > now);
});

test('SHRINK: ZONE_UPDATE carries the next shrink time, and after the final stage there is none', async () => {
  const now = Date.now();
  const roomEmits: [string, any][] = [];
  (gameLoopManager as any).io = {
    sockets: { adapter: { rooms: new Map() }, sockets: new Map() },
    to: () => ({ emit: (e: string, p: any) => roomEmits.push([e, p]) }),
  };
  const st = baseState('shrA', now);
  st.nextRevealAt = now + 600_000;
  st.nextShrinkAt = now - 1; // due now; count = 1 so this is the FINAL stage
  await gameStateStore.set('shrA', st);
  await (gameLoopManager as any).processGame(st, now);

  const upd = roomEmits.find(([e]) => e === SOCKET_EVENTS.ZONE_UPDATE)![1];
  assert.equal(upd.zone.radius, 750);
  assert.equal(upd.nextShrinkTimestamp, undefined, 'final stage: nothing left to count down to');
  assert.equal(st.nextShrinkAt, undefined);
});
