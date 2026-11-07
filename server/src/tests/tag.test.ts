import test from 'node:test';
import assert from 'node:assert/strict';
import { filterStateForPlayer } from '../game/visibility.js';
import { LiveGameState, gameStateStore } from '../game/gameStateStore.js';
import { executeConfirmTag, pendingTagAttempts } from '../socket/tagHandler.js';

test('filterStateForPlayer grants Global God-view to ELIMINATED spectators', () => {
  const mockState: LiveGameState = {
    gameId: 'game_spec_1',
    code: 'SPEC01',
    name: 'Spectator Test Match',
    hostId: 'host_1',
    status: 'running',
    settings: {
      zone: { center: { latitude: 40.785091, longitude: -73.968285 }, radius: 1000 },
      noGoZones: [],
      durationMin: 60,
      headStartMin: 2,
      revealIntervalMin: 3,
      revealMode: 'RUNNERS_TO_CHASERS',
      zoneShrink: { startAfterMin: 20, percent: 25, count: 2 },
      tagMethod: 'CODE',
      outOfZonePenalty: 'WARNING',
      teamVisibility: 'TEAMMATES_ONLY',
    },
    players: [
      { userId: 'chaser_1', username: 'APEX', role: 'CHASER', status: 'ACTIVE', ready: true },
      { userId: 'runner_1', username: 'NEON_HARE', role: 'RUNNER', status: 'ACTIVE', ready: true },
      { userId: 'runner_elim', username: 'FALLEN_ONE', role: 'RUNNER', status: 'ELIMINATED', ready: true },
    ],
    shrinkStage: 0,
    currentZone: { center: { latitude: 40.785091, longitude: -73.968285 }, radius: 1000 },
    locations: new Map([
      ['chaser_1', { userId: 'chaser_1', username: 'APEX', role: 'CHASER', coordinates: { latitude: 40.78, longitude: -73.96 }, timestamp: Date.now() }],
      ['runner_1', { userId: 'runner_1', username: 'NEON_HARE', role: 'RUNNER', coordinates: { latitude: 40.79, longitude: -73.97 }, timestamp: Date.now() }],
    ]),
    runnerSnapshots: [],
    tagCodes: new Map([
      ['runner_1', '7492'],
      ['runner_elim', '1234'],
    ]),
  };

  // 1. Chaser view: should only see chaser teammate (runner_1 live location hidden)
  const chaserView = filterStateForPlayer(mockState, 'chaser_1');
  assert.equal(chaserView.teammateLocations.length, 1);
  assert.equal(chaserView.teammateLocations[0].userId, 'chaser_1');

  // 2. Spectator (ELIMINATED) view: ALL live locations unlocked (God-view)
  const spectatorView = filterStateForPlayer(mockState, 'runner_elim');
  assert.equal(spectatorView.teammateLocations.length, 2);
  const userIds = spectatorView.teammateLocations.map((l) => l.userId);
  assert.ok(userIds.includes('chaser_1'));
  assert.ok(userIds.includes('runner_1'));
});

test('filterStateForPlayer embeds tagCode only for the authenticated runner', () => {
  const mockState: LiveGameState = {
    gameId: 'game_code_1',
    code: 'CODE01',
    name: 'Code Privacy Test',
    hostId: 'chaser_1',
    status: 'running',
    settings: {
      zone: { center: { latitude: 40.785091, longitude: -73.968285 }, radius: 1000 },
      noGoZones: [],
      durationMin: 60,
      headStartMin: 2,
      revealIntervalMin: 3,
      revealMode: 'RUNNERS_TO_CHASERS',
      zoneShrink: { startAfterMin: 20, percent: 25, count: 2 },
      tagMethod: 'CODE',
      outOfZonePenalty: 'WARNING',
      teamVisibility: 'TEAMMATES_ONLY',
    },
    players: [
      { userId: 'chaser_1', username: 'KRONOS_9', role: 'CHASER', status: 'ACTIVE', ready: true },
      { userId: 'runner_1', username: 'NEON_HARE', role: 'RUNNER', status: 'ACTIVE', ready: true },
    ],
    shrinkStage: 0,
    currentZone: { center: { latitude: 40.785091, longitude: -73.968285 }, radius: 1000 },
    locations: new Map(),
    runnerSnapshots: [],
    tagCodes: new Map([['runner_1', '7492']]),
  };

  // Runner sees their own secret PIN
  const runnerView = filterStateForPlayer(mockState, 'runner_1');
  const runnerSelf = runnerView.players.find((p) => p.userId === 'runner_1');
  assert.equal(runnerSelf?.tagCode, '7492');

  // Chaser does NOT receive runner PIN via state sync
  const chaserView = filterStateForPlayer(mockState, 'chaser_1');
  const runnerFromChaser = chaserView.players.find((p) => p.userId === 'runner_1');
  assert.equal(runnerFromChaser?.tagCode, undefined);
});

test('executeConfirmTag updates player status to ELIMINATED and triggers win condition when all runners tagged', async () => {
  const mockState: LiveGameState = {
    gameId: 'game_tag_1',
    code: 'TAG001',
    name: 'Tag Elimination Match',
    hostId: 'chaser_1',
    status: 'running',
    settings: {
      zone: { center: { latitude: 40.785091, longitude: -73.968285 }, radius: 1000 },
      noGoZones: [],
      durationMin: 60,
      headStartMin: 2,
      revealIntervalMin: 3,
      revealMode: 'RUNNERS_TO_CHASERS',
      zoneShrink: { startAfterMin: 20, percent: 25, count: 2 },
      tagMethod: 'CODE',
      outOfZonePenalty: 'WARNING',
      teamVisibility: 'TEAMMATES_ONLY',
    },
    players: [
      { userId: 'chaser_1', username: 'KRONOS_9', role: 'CHASER', status: 'ACTIVE', ready: true },
      { userId: 'runner_last', username: 'NEON_HARE', role: 'RUNNER', status: 'ACTIVE', ready: true },
    ],
    shrinkStage: 0,
    currentZone: { center: { latitude: 40.785091, longitude: -73.968285 }, radius: 1000 },
    locations: new Map(),
    runnerSnapshots: [],
    tagCodes: new Map([['runner_last', '9988']]),
  };

  await gameStateStore.set('game_tag_1', mockState);

  // Mock socket.io server
  const emittedEvents: { event: string; payload: any }[] = [];
  const mockIo: any = {
    to: () => ({
      emit: (event: string, payload: any) => emittedEvents.push({ event, payload }),
    }),
    sockets: {
      adapter: { rooms: new Map() },
      sockets: new Map(),
    },
  };

  await executeConfirmTag(mockIo, 'game_tag_1', 'runner_last', 'chaser_1', false);

  const updatedState = await gameStateStore.get('game_tag_1');
  assert.ok(updatedState);
  const runner = updatedState.players.find((p) => p.userId === 'runner_last');
  assert.equal(runner?.status, 'ELIMINATED');
  assert.equal(runner?.taggedBy, 'KRONOS_9');
  assert.ok(runner?.taggedAt);

  // Since runner_last was the only runner, game status should end with CHASER win
  assert.equal(updatedState.status, 'ended');
  assert.equal(updatedState.winnerRole, 'CHASER');

  // Verify PLAYER_TAGGED and PLAYER_ELIMINATED events were emitted
  const taggedEvent = emittedEvents.find((e) => e.event === 'player:tagged');
  assert.ok(taggedEvent);
  assert.equal(taggedEvent.payload.runnerUserId, 'runner_last');

  const eliminatedEvent = emittedEvents.find((e) => e.event === 'player:eliminated');
  assert.ok(eliminatedEvent);
  assert.equal(eliminatedEvent.payload.remainingRunners, 0);
});
