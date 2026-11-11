import test from 'node:test';
import assert from 'node:assert/strict';
import { SOCKET_EVENTS, LivePlayerLocation } from '@manhunt/shared';
import {
  validateTagProximity,
  FailureLimiter,
  TAG_MAX_DISTANCE_METERS,
  TAG_LOCATION_MAX_AGE_MS,
} from '../game/tagRules.js';
import { resolveGoogleIdentity } from '../services/googleAuth.js';
import { AppError } from '../middleware/errorHandler.js';
import { assertProductionConfig, DEV_JWT_SECRET } from '../config.js';
import { gameLoopManager } from '../game/gameLoop.js';
import { gameStateStore, LiveGameState } from '../game/gameStateStore.js';
import { filterStateForPlayer, canReceiveLiveLocation } from '../game/visibility.js';
import { registerTagHandlers } from '../socket/tagHandler.js';
import { pendingTagAttempts, clearTagStateForGame } from '../game/tagAttempts.js';

// ───────────────────────── helpers ─────────────────────────
const CENTER = { latitude: 40.0, longitude: -73.0 };
const INSIDE = { latitude: 40.0001, longitude: -73.0001 };
const OUTSIDE = { latitude: 40.03, longitude: -73.0 }; // ~3.3 km away, zone radius 1000 m

function loc(userId: string, role: 'CHASER' | 'RUNNER', coordinates = INSIDE, receivedAt = Date.now()): LivePlayerLocation {
  return { userId, username: userId, role, coordinates, timestamp: receivedAt, receivedAt };
}

function makeState(id: string, penalty: 'WARNING' | 'REVEAL' | 'ELIMINATE' = 'WARNING'): LiveGameState {
  return {
    gameId: id,
    code: id.toUpperCase(),
    name: 'T',
    hostId: 'host',
    status: 'running',
    settings: {
      zone: { center: CENTER, radius: 1000 },
      noGoZones: [],
      durationMin: 60,
      headStartMin: 1,
      revealIntervalMin: 2,
      revealMode: 'RUNNERS_TO_CHASERS',
      zoneShrink: { startAfterMin: 20, percent: 25, count: 2 },
      tagMethod: 'CODE',
      outOfZonePenalty: penalty,
      teamVisibility: 'TEAMMATES_ONLY',
    },
    players: [
      { userId: 'c1', username: 'chaser1', role: 'CHASER', status: 'ACTIVE', ready: true },
      { userId: 'c2', username: 'chaser2', role: 'CHASER', status: 'ACTIVE', ready: true },
      { userId: 'r1', username: 'runner1', role: 'RUNNER', status: 'ACTIVE', ready: true },
      { userId: 'r2', username: 'runner2', role: 'RUNNER', status: 'ACTIVE', ready: true },
    ],
    shrinkStage: 0,
    currentZone: { center: CENTER, radius: 1000 },
    locations: new Map(),
    runnerSnapshots: [],
    tagCodes: new Map([
      ['r1', '1111'],
      ['r2', '2222'],
    ]),
  };
}

type Emitted = [string, any];
function fakeSocket(userId: string) {
  const handlers: Record<string, (p: unknown) => Promise<void>> = {};
  const emitted: Emitted[] = [];
  return {
    data: { user: { userId, username: userId } },
    emitted,
    handlers,
    on(event: string, fn: (p: unknown) => Promise<void>) {
      handlers[event] = fn;
    },
    emit(event: string, payload: any) {
      emitted.push([event, payload]);
    },
  };
}

function fakeIo(gameId: string, sockets: ReturnType<typeof fakeSocket>[]) {
  const roomEmits: Emitted[] = [];
  const byId = new Map(sockets.map((s, i) => [`s${i}`, s]));
  return {
    roomEmits,
    sockets: {
      adapter: { rooms: new Map([[`game:${gameId}`, new Set(byId.keys())]]) },
      sockets: byId,
    },
    to: () => ({ emit: (e: string, p: any) => roomEmits.push([e, p]) }),
  } as any;
}

const errorsOf = (s: ReturnType<typeof fakeSocket>) =>
  s.emitted.filter(([e]) => e === SOCKET_EVENTS.ERROR).map(([, p]) => p.message as string);

// ───────────────────────── tag rules (pure) ─────────────────────────
test('tag proximity FAILS CLOSED when a location is missing', () => {
  const now = Date.now();
  assert.deepEqual(validateTagProximity(undefined, loc('r1', 'RUNNER'), now), { ok: false, reason: 'NO_LOCATION' });
  assert.deepEqual(validateTagProximity(loc('c1', 'CHASER'), undefined, now), { ok: false, reason: 'NO_LOCATION' });
});

test('tag proximity rejects stale locations (uses server receive time)', () => {
  const now = Date.now();
  const stale = loc('r1', 'RUNNER', INSIDE, now - TAG_LOCATION_MAX_AGE_MS - 1000);
  // A client-forged fresh timestamp must not help: receivedAt wins
  stale.timestamp = now;
  assert.deepEqual(validateTagProximity(loc('c1', 'CHASER', INSIDE, now), stale, now), { ok: false, reason: 'STALE_LOCATION' });
});

test('tag proximity rejects far targets and accepts near ones', () => {
  const now = Date.now();
  const far = validateTagProximity(loc('c1', 'CHASER', INSIDE, now), loc('r1', 'RUNNER', OUTSIDE, now), now);
  assert.equal(far.ok, false);
  const near = validateTagProximity(loc('c1', 'CHASER', INSIDE, now), loc('r1', 'RUNNER', INSIDE, now), now);
  assert.equal(near.ok, true);
  assert.ok(TAG_MAX_DISTANCE_METERS > 0);
});

test('FailureLimiter blocks after max failures and recovers after the window', () => {
  const lim = new FailureLimiter(3, 1000);
  for (let i = 0; i < 3; i++) lim.recordFailure('k', 1000 + i);
  assert.equal(lim.isBlocked('k', 1100), true);
  assert.equal(lim.isBlocked('k', 5000), false);
});

// ───────────────────────── tag handler (end to end, fake sockets) ─────────────────────────
async function tagScenario(id: string, setup: (s: LiveGameState) => void) {
  const state = makeState(id);
  setup(state);
  await gameStateStore.set(id, state);
  const chaser = fakeSocket('c1');
  const runner = fakeSocket('r1');
  const other = fakeSocket('c2');
  const io = fakeIo(id, [chaser, runner, other]);
  registerTagHandlers(io, chaser as any);
  registerTagHandlers(io, runner as any);
  registerTagHandlers(io, other as any);
  (gameLoopManager as any).io = io;
  return { state, chaser, runner, other, io };
}

test('TAG: the code is mandatory - targetUserId alone is rejected', async () => {
  const { chaser } = await tagScenario('tagA', (s) => {
    s.locations.set('c1', loc('c1', 'CHASER'));
    s.locations.set('r1', loc('r1', 'RUNNER'));
  });
  await chaser.handlers[SOCKET_EVENTS.TAG_ATTEMPT]({ gameId: 'tagA', targetUserId: 'r1' });
  assert.equal(pendingTagAttempts.size, 0);
  assert.equal(errorsOf(chaser).length, 1);
  clearTagStateForGame('tagA');
});

test('TAG: correct code but missing runner location is rejected (fail-closed)', async () => {
  const { chaser } = await tagScenario('tagB', (s) => {
    s.locations.set('c1', loc('c1', 'CHASER')); // runner location missing
  });
  await chaser.handlers[SOCKET_EVENTS.TAG_ATTEMPT]({ gameId: 'tagB', runnerCode: '1111' });
  assert.equal(pendingTagAttempts.size, 0);
  assert.equal(errorsOf(chaser).length, 1);
  clearTagStateForGame('tagB');
});

test('TAG: too-far rejection never reveals the distance to the chaser', async () => {
  const { chaser } = await tagScenario('tagC', (s) => {
    s.locations.set('c1', loc('c1', 'CHASER', INSIDE));
    s.locations.set('r1', loc('r1', 'RUNNER', OUTSIDE));
  });
  await chaser.handlers[SOCKET_EVENTS.TAG_ATTEMPT]({ gameId: 'tagC', runnerCode: '1111' });
  assert.equal(pendingTagAttempts.size, 0);
  const [msg] = errorsOf(chaser);
  assert.ok(msg && !/\d/.test(msg), `message must not contain numbers: ${msg}`);
  clearTagStateForGame('tagC');
});

test('TAG: valid code + proximity prompts ONLY the runner; only the runner can confirm', async () => {
  const { state, chaser, runner, other } = await tagScenario('tagD', (s) => {
    s.locations.set('c1', loc('c1', 'CHASER'));
    s.locations.set('r1', loc('r1', 'RUNNER'));
  });
  await chaser.handlers[SOCKET_EVENTS.TAG_ATTEMPT]({ gameId: 'tagD', runnerCode: '1111' });
  assert.equal(pendingTagAttempts.size, 1);
  assert.equal(runner.emitted.filter(([e]) => e === SOCKET_EVENTS.TAG_ATTEMPT).length, 1);
  assert.equal(other.emitted.filter(([e]) => e === SOCKET_EVENTS.TAG_ATTEMPT).length, 0);

  const attemptId = [...pendingTagAttempts.keys()][0];

  // Another chaser tries to confirm / dispute someone else's attempt -> refused
  await other.handlers[SOCKET_EVENTS.TAG_CONFIRM]({ gameId: 'tagD', attemptId });
  await other.handlers[SOCKET_EVENTS.TAG_DISPUTE]({ gameId: 'tagD', attemptId });
  assert.equal(pendingTagAttempts.size, 1);
  assert.equal(state.players.find((p) => p.userId === 'r1')!.status, 'ACTIVE');

  // The chaser cannot confirm their own tag either
  await chaser.handlers[SOCKET_EVENTS.TAG_CONFIRM]({ gameId: 'tagD', attemptId });
  assert.equal(state.players.find((p) => p.userId === 'r1')!.status, 'ACTIVE');

  // The runner confirms -> eliminated (r2 still alive, so game continues)
  await runner.handlers[SOCKET_EVENTS.TAG_CONFIRM]({ gameId: 'tagD', attemptId });
  assert.equal(state.players.find((p) => p.userId === 'r1')!.status, 'ELIMINATED');
  assert.equal(pendingTagAttempts.size, 0);
  clearTagStateForGame('tagD');
});

test('TAG: runner dispute cancels the attempt and starts a cooldown', async () => {
  const { state, chaser, runner } = await tagScenario('tagE', (s) => {
    s.locations.set('c1', loc('c1', 'CHASER'));
    s.locations.set('r1', loc('r1', 'RUNNER'));
  });
  await chaser.handlers[SOCKET_EVENTS.TAG_ATTEMPT]({ gameId: 'tagE', runnerCode: '1111' });
  await runner.handlers[SOCKET_EVENTS.TAG_DISPUTE]({ gameId: 'tagE' });
  assert.equal(pendingTagAttempts.size, 0);
  assert.equal(state.players.find((p) => p.userId === 'r1')!.status, 'ACTIVE');

  chaser.emitted.length = 0;
  await chaser.handlers[SOCKET_EVENTS.TAG_ATTEMPT]({ gameId: 'tagE', runnerCode: '1111' });
  assert.equal(pendingTagAttempts.size, 0, 'cooldown must block an immediate retry');
  assert.equal(errorsOf(chaser).length, 1);
  clearTagStateForGame('tagE');
});

test('TAG: brute-forcing the 4-digit code is rate limited', async () => {
  const { chaser } = await tagScenario('tagF', (s) => {
    s.locations.set('c1', loc('c1', 'CHASER'));
    s.locations.set('r1', loc('r1', 'RUNNER'));
  });
  for (const guess of ['0001', '0002', '0003', '0004', '0005']) {
    await chaser.handlers[SOCKET_EVENTS.TAG_ATTEMPT]({ gameId: 'tagF', runnerCode: guess });
  }
  chaser.emitted.length = 0;
  // Even the CORRECT code is refused while blocked
  await chaser.handlers[SOCKET_EVENTS.TAG_ATTEMPT]({ gameId: 'tagF', runnerCode: '1111' });
  assert.equal(pendingTagAttempts.size, 0);
  assert.match(errorsOf(chaser)[0], /too many/i);
  clearTagStateForGame('tagF');
});

// ───────────────────────── zone penalties ─────────────────────────
async function zoneScenario(id: string, penalty: 'WARNING' | 'REVEAL' | 'ELIMINATE') {
  const state = makeState(id, penalty);
  state.locations.set('c1', loc('c1', 'CHASER'));
  state.locations.set('r1', loc('r1', 'RUNNER', OUTSIDE));
  state.locations.set('r2', loc('r2', 'RUNNER'));
  await gameStateStore.set(id, state);
  const chaser = fakeSocket('c1');
  const runner = fakeSocket('r1');
  const runner2 = fakeSocket('r2');
  const io = fakeIo(id, [chaser, runner, runner2]);
  (gameLoopManager as any).io = io;
  return { state, chaser, runner, runner2, io };
}

test('ZONE: warnings go ONLY to the player who breached (no leak to chasers or room)', async () => {
  const { state, chaser, runner, runner2, io } = await zoneScenario('zoneA', 'WARNING');
  await gameLoopManager.processZoneBreaches(state, 1_000_000);
  const got = (s: ReturnType<typeof fakeSocket>) => s.emitted.filter(([e]) => e === SOCKET_EVENTS.ZONE_VIOLATION);
  assert.equal(got(runner).length, 1);
  assert.equal(got(runner)[0][1].inViolation, true);
  assert.equal(got(chaser).length, 0);
  assert.equal(got(runner2).length, 0);
  assert.equal(io.roomEmits.filter(([e]: Emitted) => e === SOCKET_EVENTS.ZONE_VIOLATION).length, 0);
});

test('ZONE: returning inside the zone sends a single all-clear to that player', async () => {
  const { state, runner } = await zoneScenario('zoneB', 'WARNING');
  await gameLoopManager.processZoneBreaches(state, 1_000_000);
  state.locations.set('r1', loc('r1', 'RUNNER', INSIDE));
  runner.emitted.length = 0;
  await gameLoopManager.processZoneBreaches(state, 1_002_000);
  await gameLoopManager.processZoneBreaches(state, 1_003_000);
  const events = runner.emitted.filter(([e]) => e === SOCKET_EVENTS.ZONE_VIOLATION);
  assert.equal(events.length, 1);
  assert.equal(events[0][1].inViolation, false);
});

test('ZONE: ELIMINATE penalty eliminates after the 30s grace period, not before', async () => {
  const { state } = await zoneScenario('zoneC', 'ELIMINATE');
  await gameLoopManager.processZoneBreaches(state, 1_000_000);
  await gameLoopManager.processZoneBreaches(state, 1_020_000);
  assert.equal(state.players.find((p) => p.userId === 'r1')!.status, 'ACTIVE');
  await gameLoopManager.processZoneBreaches(state, 1_031_000);
  assert.equal(state.players.find((p) => p.userId === 'r1')!.status, 'ELIMINATED');
});

test('ZONE: REVEAL penalty exposes the runner to chasers only after the grace period', async () => {
  const { state } = await zoneScenario('zoneD', 'REVEAL');
  await gameLoopManager.processZoneBreaches(state, 1_000_000);
  assert.equal(canReceiveLiveLocation(state, 'r1', 'c1'), false);
  assert.ok(!filterStateForPlayer(state, 'c1').teammateLocations.some((l) => l.userId === 'r1'));

  await gameLoopManager.processZoneBreaches(state, 1_031_000);
  assert.equal(canReceiveLiveLocation(state, 'r1', 'c1'), true);
  assert.ok(filterStateForPlayer(state, 'c1').teammateLocations.some((l) => l.userId === 'r1'));
  // other runners stay hidden
  assert.equal(canReceiveLiveLocation(state, 'r2', 'c1'), false);
});

test('BOTH_WAYS: runners get chaser snapshots, never their own team', () => {
  const state = makeState('both');
  state.settings.revealMode = 'BOTH_WAYS';
  state.runnerSnapshots = [{ userId: 'r1', username: 'runner1', coordinates: INSIDE, timestamp: 1 }];
  state.chaserSnapshots = [{ userId: 'c1', username: 'chaser1', coordinates: INSIDE, timestamp: 1 }];
  const runnerView = filterStateForPlayer(state, 'r2');
  assert.equal(runnerView.runnerSnapshots.length, 0);
  assert.equal(runnerView.chaserSnapshots?.[0].userId, 'c1');
  const chaserView = filterStateForPlayer(state, 'c1');
  assert.equal(chaserView.runnerSnapshots[0].userId, 'r1');
});

// ───────────────────────── google auth ─────────────────────────
const baseDeps = { audiences: ['web-id'], allowDevMock: false, nodeEnv: 'production' };

test('GOOGLE: client-supplied email/googleId are NOT trusted without a token', async () => {
  await assert.rejects(
    resolveGoogleIdentity({ googleId: 'victim', email: 'victim@gmail.com' }, baseDeps),
    (e: any) => e instanceof AppError && e.statusCode === 401
  );
});

test('GOOGLE: dev mock only works when explicitly enabled AND not in production', async () => {
  const input = { googleId: 'g1', email: 'A@B.com' };
  const ok = await resolveGoogleIdentity(input, { ...baseDeps, allowDevMock: true, nodeEnv: 'development' });
  assert.deepEqual(ok, { googleId: 'g1', email: 'a@b.com' });
  await assert.rejects(resolveGoogleIdentity(input, { ...baseDeps, allowDevMock: true, nodeEnv: 'production' }));
  await assert.rejects(resolveGoogleIdentity(input, { ...baseDeps, allowDevMock: false, nodeEnv: 'development' }));
});

test('GOOGLE: a verified token yields the identity from the TOKEN, not the request body', async () => {
  const verifier = async () => ({ googleId: 'real-sub', email: 'real@gmail.com' });
  const id = await resolveGoogleIdentity(
    { idToken: 'x'.repeat(30), googleId: 'attacker', email: 'victim@gmail.com' },
    { ...baseDeps, verifier }
  );
  assert.deepEqual(id, { googleId: 'real-sub', email: 'real@gmail.com' });
});

test('GOOGLE: invalid token -> 401, and missing server config -> 503', async () => {
  const bad = async () => {
    throw new Error('bad signature');
  };
  await assert.rejects(
    resolveGoogleIdentity({ idToken: 'x'.repeat(30) }, { ...baseDeps, verifier: bad }),
    (e: any) => e.statusCode === 401
  );
  await assert.rejects(
    resolveGoogleIdentity({ idToken: 'x'.repeat(30) }, { ...baseDeps, audiences: [] }),
    (e: any) => e.statusCode === 503
  );
});

// ───────────────────────── production config ─────────────────────────
test('CONFIG: production refuses default/placeholder JWT secrets and localhost DB', () => {
  const prod = { NODE_ENV: 'production' as const, MONGODB_URI: 'mongodb+srv://x/y' };
  assert.throws(() => assertProductionConfig({ ...prod, JWT_SECRET: DEV_JWT_SECRET }));
  assert.throws(() => assertProductionConfig({ ...prod, JWT_SECRET: 'super-secret-jwt-key-replace-in-production' }));
  assert.throws(() => assertProductionConfig({ ...prod, JWT_SECRET: 'short' }));
  assert.throws(() =>
    assertProductionConfig({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://localhost:27017/x', JWT_SECRET: 'a'.repeat(48) })
  );
  assert.doesNotThrow(() => assertProductionConfig({ ...prod, JWT_SECRET: 'k9Zr2qL0vXb7TnWc4YdPaE8sGhJm1UoF' }));
  assert.doesNotThrow(() => assertProductionConfig({ NODE_ENV: 'development', MONGODB_URI: 'mongodb://localhost/x', JWT_SECRET: DEV_JWT_SECRET }));
});
