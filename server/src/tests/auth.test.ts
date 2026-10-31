import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../app.js';
import { hashPassword, verifyPassword, generateToken, verifyToken } from '../utils/auth.js';
import { User } from '../models/User.js';

test('Password hashing and verification', () => {
  const password = 'tactical_runner_99';
  const hash = hashPassword(password);

  assert.notEqual(hash, password);
  assert.ok(hash.includes(':'));
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword('wrong_password', hash), false);
});

test('JWT generation and verification payload', () => {
  const fakeUser: any = {
    _id: '507f1f77bcf86cd799439011',
    email: 'chaser@manhunt.live',
    username: 'apex_chaser',
  };

  const token = generateToken(fakeUser);
  assert.ok(typeof token === 'string');

  const decoded = verifyToken(token);
  assert.equal(decoded.userId, fakeUser._id);
  assert.equal(decoded.email, fakeUser.email);
  assert.equal(decoded.username, fakeUser.username);
});

test('Auth Guard rejects requests without Bearer token with 401', async () => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Server error');

    const res = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes('Authentication required'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Auth Guard rejects invalid token with 401', async () => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Server error');

    const res = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`, {
      headers: {
        Authorization: 'Bearer invalid.jwt.token.string',
      },
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid or expired'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Check username endpoint validates format correctly', async () => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Server error');

    // Test too short
    const resShort = await fetch(`http://127.0.0.1:${address.port}/api/auth/check-username?username=ab`);
    const dataShort = await resShort.json();
    assert.equal(dataShort.available, false);
    assert.ok(dataShort.reason);

    // Test invalid characters
    const resInvalid = await fetch(`http://127.0.0.1:${address.port}/api/auth/check-username?username=bad!name`);
    const dataInvalid = await resInvalid.json();
    assert.equal(dataInvalid.available, false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Username uniqueness case-insensitive check logic', async () => {
  // Test case-insensitive collision check logic
  const originalFindOne = User.findOne;
  try {
    // Mock User.findOne to simulate existing lowercase user 'shadow_runner'
    (User as any).findOne = async (query: any) => {
      if (query.username === 'shadow_runner') {
        return { username: 'shadow_runner', email: 'shadow@test.com' };
      }
      return null;
    };

    const app = createApp();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));

    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Server error');

    // Query with mixed uppercase
    const res = await fetch(`http://127.0.0.1:${address.port}/api/auth/check-username?username=SHADOW_RUNNER`);
    const data = await res.json();
    assert.equal(data.available, false);
    assert.equal(data.username, 'shadow_runner');

    // Query for new unique user
    const resAvailable = await fetch(`http://127.0.0.1:${address.port}/api/auth/check-username?username=NEW_OPERATOR`);
    const dataAvailable = await resAvailable.json();
    assert.equal(dataAvailable.available, true);
    assert.equal(dataAvailable.username, 'new_operator');

    await new Promise<void>((resolve) => server.close(() => resolve()));
  } finally {
    User.findOne = originalFindOne;
  }
});
