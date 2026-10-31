import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { AppError } from './errors.js';

test('analysis failures expose a valid retry time without forwarding arbitrary headers', async () => {
  const error = new AppError(503, 'Please try again in 12 seconds.');
  error.retryAfter = 12;
  const server = createApp({ analyze: async () => { throw error; } }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/analyze`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'text', content: 'Hello' }),
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '12');
    assert.equal((await response.json()).error, 'Please try again in 12 seconds.');
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
