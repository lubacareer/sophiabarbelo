import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';

const result = { claims: [], rhetoric: [], limitations: [] };
const trustedSecret = 'a-test-secret-that-is-not-a-real-credential';

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function post(base, content = 'A claim to analyze', headers = {}) {
  return fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ type: 'text', content }),
  });
}

test('anonymous requests are limited per client and spoofed headers cannot grant admin access', async () => {
  let time = 1_000;
  const app = createApp({ analyze: async () => result, proxySecret: trustedSecret, now: () => time });
  await withServer(app, async (base) => {
    for (let i = 0; i < 10; i++) {
      const response = await post(base, 'A claim', { 'X-Sophia-Client-IP': `192.0.2.${i + 1}`, 'X-Sophia-Admin': '1' });
      assert.equal(response.status, 200);
    }
    const blocked = await post(base, 'A claim', { Authorization: 'Bearer wrong', 'X-Sophia-Admin': '1' });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '600');

    const admin = { Authorization: `Bearer ${trustedSecret}`, 'X-Sophia-Admin': '1', 'X-Sophia-Client-IP': '192.0.2.1' };
    assert.equal((await post(base, 'A claim', admin)).status, 200);
    assert.equal((await post(base, 'A claim', { ...admin, 'X-Sophia-Admin': '0' })).status, 200);
    assert.equal((await post(base, 'A claim', { ...admin, 'X-Sophia-Admin': '0', 'X-Sophia-Client-IP': 'not-an-ip' })).status, 400);
    time += 10 * 60_000;
    assert.equal((await post(base)).status, 200);
  });
});

test('concurrency limit covers actual work and is released after failures', async () => {
  const pending = [];
  const app = createApp({ proxySecret: trustedSecret, analyze: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) });
  await withServer(app, async (base) => {
    const first = [post(base), post(base), post(base)];
    while (pending.length < 3) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal((await post(base)).status, 429);

    const adminRequest = post(base, 'An admin claim', { Authorization: `Bearer ${trustedSecret}`, 'X-Sophia-Admin': '1' });
    while (pending.length < 4) await new Promise((resolve) => setTimeout(resolve, 5));
    pending[3].resolve(result);
    assert.equal((await adminRequest).status, 200);

    pending[0].reject(new Error('failed analysis'));
    assert.equal((await first[0]).status, 500);
    const next = post(base);
    while (pending.length < 5) await new Promise((resolve) => setTimeout(resolve, 5));
    pending[4].resolve(result);
    pending[1].resolve(result);
    pending[2].resolve(result);
    assert.equal((await next).status, 200);
    assert.equal((await first[1]).status, 200);
    assert.equal((await first[2]).status, 200);
  });
});

test('a client disconnect does not release capacity while analysis is still running', async () => {
  const pending = [];
  const app = createApp({ analyze: () => new Promise((resolve) => pending.push(resolve)) });
  await withServer(app, async (base) => {
    const controller = new AbortController();
    const disconnected = fetch(`${base}/api/analyze`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'text', content: 'A claim' }), signal: controller.signal,
    }).catch(() => null);
    const otherRequests = [post(base), post(base)];
    while (pending.length < 3) await new Promise((resolve) => setTimeout(resolve, 5));
    controller.abort();
    await disconnected;
    assert.equal((await post(base)).status, 429);
    pending[0](result);
    pending[1](result);
    pending[2](result);
    await Promise.all(otherRequests);
    const next = post(base);
    while (pending.length < 4) await new Promise((resolve) => setTimeout(resolve, 5));
    pending[3](result);
    assert.equal((await next).status, 200);
  });
});

test('equivalent trusted IPv6 spellings share a client quota', async () => {
  const app = createApp({ analyze: async () => result, proxySecret: trustedSecret });
  await withServer(app, async (base) => {
    const headers = { Authorization: `Bearer ${trustedSecret}`, 'X-Sophia-Admin': '0' };
    for (let i = 0; i < 10; i++) {
      const address = i % 2 ? '2001:db8::1' : '2001:0db8:0000:0000:0000:0000:0000:0001';
      assert.equal((await post(base, 'A claim', { ...headers, 'X-Sophia-Client-IP': address })).status, 200);
    }
    assert.equal((await post(base, 'A claim', { ...headers, 'X-Sophia-Client-IP': '2001:db8::1' })).status, 429);
    assert.equal((await post(base, 'A claim', { ...headers, 'X-Sophia-Client-IP': '2001:db8::2' })).status, 200);
  });
});

test('valid multibyte and escaped 30,000-character text fits the body limit', async () => {
  const seen = [];
  const app = createApp({ analyze: async (text) => { seen.push(text); return result; } });
  await withServer(app, async (base) => {
    assert.equal((await post(base, '界'.repeat(30_000))).status, 200);
    assert.equal((await post(base, '\u0001'.repeat(30_000))).status, 200);
    assert.equal((await post(base, '界'.repeat(30_001))).status, 400);
    assert.equal(seen[0].length, 30_000);
    assert.equal(seen[1].length, 30_000);
  });
});
