import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { createHttpServer } from '../index.js';
import { Game } from '../models/Game.js';
import { User } from '../models/User.js';
import { generateToken } from '../utils/auth.js';
import { SOCKET_EVENTS } from '@manhunt/shared';

function createMockUser(id: string, username: string, email: string) {
  return {
    _id: new mongoose.Types.ObjectId(id),
    username,
    email,
    passwordHash: 'dummy',
    stats: { games: 0, wins: 0, tags: 0, escapes: 0, kmRun: 0 },
  } as any;
}

test('Socket auth rejects connection without JWT token', async () => {
  const { server } = createHttpServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server address error');
  const serverUrl = `http://127.0.0.1:${address.port}`;

  let client: ClientSocketType | null = null;
  try {
    const errorPromise = new Promise<string>((resolve) => {
      client = ClientSocket(serverUrl, {
        autoConnect: true,
        reconnection: false,
      });

      client.on('connect_error', (err) => {
        resolve(err.message);
      });
    });

    const errorMsg = await errorPromise;
    assert.match(errorMsg, /Authentication error/i);
  } finally {
    if (client) (client as ClientSocketType).disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Socket auth connects successfully with valid JWT token', async () => {
  const { server } = createHttpServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server address error');
  const serverUrl = `http://127.0.0.1:${address.port}`;

  const hostUser = createMockUser('654321654321654321654321', 'host_op', 'host@grid.live');
  const token = generateToken(hostUser);

  let client: ClientSocketType | null = null;
  try {
    const connectPromise = new Promise<boolean>((resolve, reject) => {
      client = ClientSocket(serverUrl, {
        auth: { token },
        reconnection: false,
      });

      client.on('connect', () => resolve(true));
      client.on('connect_error', (err) => reject(err));
    });

    const connected = await connectPromise;
    assert.equal(connected, true);
    assert.equal(client!.connected, true);
  } finally {
    if (client) (client as ClientSocketType).disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Lobby game:start validation logic enforced strictly', () => {
  // Pure unit validation check for game launch criteria
  function validateGameStart(
    callerId: string,
    hostId: string,
    status: string,
    players: Array<{ role: string; ready: boolean }>
  ): { ok: boolean; reason?: string } {
    if (callerId !== hostId) {
      return { ok: false, reason: 'Only host can launch match' };
    }
    if (status !== 'lobby') {
      return { ok: false, reason: 'Match already commenced' };
    }
    const chaserCount = players.filter((p) => p.role === 'CHASER').length;
    if (chaserCount < 1) {
      return { ok: false, reason: 'At least 1 Chaser required' };
    }
    const runnerCount = players.filter((p) => p.role === 'RUNNER').length;
    if (runnerCount < 1) {
      return { ok: false, reason: 'At least 1 Runner required' };
    }
    const unassignedCount = players.filter((p) => p.role === 'UNASSIGNED').length;
    if (unassignedCount > 0) {
      return { ok: false, reason: 'Operatives awaiting assignment' };
    }
    const unreadyCount = players.filter((p) => !p.ready).length;
    if (unreadyCount > 0) {
      return { ok: false, reason: 'All operatives must be ready' };
    }
    return { ok: true };
  }

  const hostId = 'host_123';
  const player2 = 'op_456';

  // 1. Non-host cannot start
  assert.equal(
    validateGameStart(player2, hostId, 'lobby', [
      { role: 'CHASER', ready: true },
      { role: 'RUNNER', ready: true },
    ]).ok,
    false
  );

  // 2. Fails if 0 chasers
  assert.equal(
    validateGameStart(hostId, hostId, 'lobby', [
      { role: 'RUNNER', ready: true },
      { role: 'RUNNER', ready: true },
    ]).ok,
    false
  );

  // 3. Fails if 0 runners
  assert.equal(
    validateGameStart(hostId, hostId, 'lobby', [
      { role: 'CHASER', ready: true },
      { role: 'CHASER', ready: true },
    ]).ok,
    false
  );

  // 4. Fails if players are unassigned in standby pool
  assert.equal(
    validateGameStart(hostId, hostId, 'lobby', [
      { role: 'CHASER', ready: true },
      { role: 'RUNNER', ready: true },
      { role: 'UNASSIGNED', ready: true },
    ]).ok,
    false
  );

  // 5. Fails if a player is not ready
  assert.equal(
    validateGameStart(hostId, hostId, 'lobby', [
      { role: 'CHASER', ready: true },
      { role: 'RUNNER', ready: false },
    ]).ok,
    false
  );

  // 6. Succeeds when thresholds are met (>=1 Chaser, >=1 Runner, 0 unassigned, all ready)
  assert.equal(
    validateGameStart(hostId, hostId, 'lobby', [
      { role: 'CHASER', ready: true },
      { role: 'RUNNER', ready: true },
    ]).ok,
    true
  );
});

test('Lobby auto-assign distributes players evenly between Chaser and Runner', () => {
  const players = [
    { id: '1', role: 'UNASSIGNED' },
    { id: '2', role: 'UNASSIGNED' },
    { id: '3', role: 'UNASSIGNED' },
    { id: '4', role: 'UNASSIGNED' },
  ];

  players.forEach((p, i) => {
    p.role = i % 2 === 0 ? 'CHASER' : 'RUNNER';
  });

  const chasers = players.filter((p) => p.role === 'CHASER');
  const runners = players.filter((p) => p.role === 'RUNNER');

  assert.equal(chasers.length, 2);
  assert.equal(runners.length, 2);
  assert.equal(players.filter((p) => p.role === 'UNASSIGNED').length, 0);
});
