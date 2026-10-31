import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../app.js';

test('Health route responds with 200 OK', async () => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server address error');
    }

    const res = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.ok(typeof data.uptime === 'number');
    assert.ok(typeof data.timestamp === 'number');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

