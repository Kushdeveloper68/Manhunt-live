import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../app.js';
import { generateRandomCode } from '../utils/gameCode.js';
import { Game } from '../models/Game.js';

test('Game Code generator produces valid 6-char unambiguous code', () => {
  const codes = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const code = generateRandomCode(6);
    assert.equal(code.length, 6);
    assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    // Should never contain easily confused characters: 0, O, 1, I
    assert.equal(code.includes('0'), false);
    assert.equal(code.includes('O'), false);
    assert.equal(code.includes('1'), false);
    assert.equal(code.includes('I'), false);
    codes.add(code);
  }
  // Codes should be random with high entropy
  assert.ok(codes.size > 45);
});

test('Create Game endpoint requires authentication (returns 401)', async () => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Server address error');

    const res = await fetch(`http://127.0.0.1:${address.port}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Central Park' }),
    });

    assert.equal(res.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Get Game by code rejects codes with invalid length', async () => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Server address error');

    // 4 chars instead of 6
    const res = await fetch(`http://127.0.0.1:${address.port}/api/games/code/MH42`);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('6-character'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Get Game by code returns 404 when session not found', async () => {
  const originalFindOne = Game.findOne;
  try {
    (Game as any).findOne = () => ({
      populate: () => ({
        populate: async () => null,
      }),
    });

    const app = createApp();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));

    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Server address error');

    const res = await fetch(`http://127.0.0.1:${address.port}/api/games/code/NOTFND`);
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.ok(data.error.includes('No active game session found'));

    await new Promise<void>((resolve) => server.close(() => resolve()));
  } finally {
    Game.findOne = originalFindOne;
  }
});

test('Get Game by code returns 200 with populated game details', async () => {
  const originalFindOne = Game.findOne;
  try {
    const mockGame = {
      _id: '507f1f77bcf86cd799439011',
      code: 'MH7842',
      name: 'Midtown Shadow Pursuit',
      mode: 'Classic Manhunt',
      settings: {
        zone: { center: { latitude: 40.785, longitude: -73.968 }, radius: 1500 },
        durationMin: 60,
        headStartMin: 3,
        revealIntervalMin: 2,
      },
      status: 'lobby',
      players: [
        {
          userId: { username: 'metro_hawk', avatarId: 'hawk' },
          role: 'CHASER',
          status: 'ACTIVE',
          ready: true,
        },
      ],
    };

    (Game as any).findOne = () => ({
      populate: () => ({
        populate: async () => mockGame,
      }),
    });

    const app = createApp();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));

    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Server address error');

    const res = await fetch(`http://127.0.0.1:${address.port}/api/games/code/MH7842`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.game.code, 'MH7842');
    assert.equal(data.game.name, 'Midtown Shadow Pursuit');
    assert.equal(data.game.players.length, 1);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  } finally {
    Game.findOne = originalFindOne;
  }
});
