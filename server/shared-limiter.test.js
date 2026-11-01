import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { createSharedLimiter, PUBLIC_LIMITS } from './shared-limiter.js';
import { AppError } from './errors.js';

const emptyResult = { claims: [], rhetoric: [], limitations: [] };

async function withServers(apps, run) {
  const servers = apps.map((app) => app.listen(0, '127.0.0.1'));
  await Promise.all(servers.map((server) => new Promise((resolve) => server.once('listening', resolve))));
  try { await run(servers.map((server) => `http://127.0.0.1:${server.address().port}`)); }
  finally { await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve)))); }
}

function post(base, ip, extra = {}, content = 'Claim', type = 'text') {
  return fetch(`${base}/api/analyze`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(ip ? { 'x-forwarded-for': ip } : {}), ...extra },
    body: JSON.stringify({ type, content }),
  });
}

test('shared limiter uses one atomic acquisition and a unique lease for release', async () => {
  const commands = [];
  const limiter = createSharedLimiter({ url: 'https://redis.example', token: 'private-token', fetchImpl: async (_url, options) => {
    commands.push({ body: JSON.parse(options.body), auth: options.headers.authorization });
    return { ok: true, json: async () => ({ result: commands.length === 1 ? [1, 0] : 1 }) };
  } });
  const release = await limiter.acquire('v4:192.0.2.1');
  await release();
  assert.equal(commands[0].body[0], 'EVAL');
  assert.equal(commands[0].body[2], 4);
  assert.match(commands[0].body[1], /ZREMRANGEBYSCORE/);
  assert.match(commands[0].body[1], /330000/);
  assert.equal(commands[0].auth, 'Bearer private-token');
  const [, , , globalLeases, clientLeases, burst, daily, lease] = commands[0].body;
  assert.equal(globalLeases, 'sophia:public:leases');
  assert.match(clientLeases, /^sophia:public:client-leases:[a-f0-9]{64}$/);
  assert.equal(burst, clientLeases.replace(':client-leases:', ':rate:'));
  assert.equal(daily, clientLeases.replace(':client-leases:', ':daily:'));
  assert.match(lease, /^[a-f0-9-]{36}$/);
  assert.equal(commands[1].body[0], 'EVAL');
  assert.match(commands[1].body[1], /ZREM/);
  assert.deepEqual(commands[1].body.slice(2), [2, globalLeases, clientLeases, lease]);
  assert.equal(Object.isFrozen(PUBLIC_LIMITS), true);
});

test('shared limiter fails closed on missing configuration, bad storage responses, and unavailable storage', async () => {
  for (const opts of [
    { url: undefined, token: '' },
    { url: 'http://redis.example', token: 'test' },
    { url: 'https://redis.example', token: 'test', fetchImpl: async () => ({ ok: false }) },
    { url: 'https://redis.example', token: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ result: [-1, 0] }) }) },
    ...[null, [4, 10], [3, -1], [3, '10'], [3, 1.5], [1, 0, 0]].map((result) => ({ url: 'https://redis.example', token: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ result }) }) })),
    { url: 'https://redis.example', token: 'test', fetchImpl: async () => { throw new Error('secret'); } },
  ]) await assert.rejects(() => createSharedLimiter(opts).acquire('v4:test'), (error) => error.status === 503 && !error.message.includes('secret'));
});

test('shared limiter forwards burst, daily, and concurrency retry information', async () => {
  for (const [result, pattern] of [[[0, 45], /Too many/], [[3, 86_399], /Daily analysis limit reached/], [[2, 10], /busy/]]) {
    const limiter = createSharedLimiter({ url: 'https://redis.example', token: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ result }) }) });
    await assert.rejects(() => limiter.acquire('v4:test'), (error) => error.status === 429 && error.retryAfter === result[1] && pattern.test(error.message));
  }
});

test('shared limiter rejects malformed release responses', async () => {
  for (const result of [-1, 3, null, '2']) {
    let calls = 0;
    const limiter = createSharedLimiter({ url: 'https://redis.example', token: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ result: ++calls === 1 ? [1, 0] : result }) }) });
    const release = await limiter.acquire('v4:test');
    await assert.rejects(release, (error) => error.status === 503);
  }
});

test('public daily exhaustion returns its retry time without starting work', async () => {
  let acquisitions = 0;
  let analyses = 0;
  const sharedLimiter = createSharedLimiter({ url: 'https://redis.example', token: 'test', fetchImpl: async () => {
    acquisitions++;
    return { ok: true, json: async () => ({ result: [3, 43_210] }) };
  } });
  const app = createApp({ deployment: 'public', sharedLimiter, analyze: async () => { analyses++; return emptyResult; } });
  await withServers([app], async ([base]) => {
    const response = await post(base, '192.0.2.1');
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '43210');
    assert.deepEqual(await response.json(), { error: 'Daily analysis limit reached. Please try again later.' });
  });
  assert.equal(acquisitions, 1);
  assert.equal(analyses, 0);
});

test('public instances share a limiter and ignore Caddy identity headers', async () => {
  const entries = new Map();
  const keys = [];
  const limiter = { acquire: async (key) => {
    keys.push(key);
    const count = entries.get(key) || 0;
    if (count >= PUBLIC_LIMITS.burstCount) throw new AppError(429, 'Too many analyses.');
    entries.set(key, count + 1);
    return async () => {};
  } };
  const apps = [createApp({ deployment: 'public', sharedLimiter: limiter, analyze: async () => emptyResult }), createApp({ deployment: 'public', sharedLimiter: limiter, analyze: async () => emptyResult })];
  await withServers(apps, async ([first, second]) => {
    const spoof = { 'x-sophia-admin': '1', 'x-sophia-client-ip': '203.0.113.2', authorization: 'Bearer pretend-secret' };
    for (let i = 0; i < PUBLIC_LIMITS.burstCount; i++) assert.equal((await post(i % 2 ? first : second, i % 2 ? '2001:db8::1' : '2001:db8::2', spoof)).status, 200);
    assert.equal((await post(first, '2001:db8::1', spoof)).status, 429);
    assert.equal(new Set(keys).size, 1);
    assert.equal((await post(first, '2001:db8:0:1::1', spoof)).status, 200);
    assert.equal((await post(first, null, spoof)).status, 400);
    assert.equal((await post(first, '192.0.2.4', spoof, 'http://127.0.0.1', 'url')).status, 400);
  });
});

test('public analysis holds and releases capacity after success and error', async () => {
  let active = 0;
  const pending = [];
  const limiter = { acquire: async () => {
    if (active >= 3) throw new AppError(429, 'The analyzer is busy.');
    active++;
    return async () => { active--; };
  } };
  const apps = [createApp({ deployment: 'public', sharedLimiter: limiter, analyze: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) }), createApp({ deployment: 'public', sharedLimiter: limiter, analyze: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) })];
  await withServers(apps, async ([first, second]) => {
    const requests = [];
    for (const [index, base] of [first, second, first].entries()) {
      requests.push(post(base, `192.0.2.${index + 1}`));
      while (pending.length <= index) await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal((await post(second, '192.0.2.4')).status, 429);
    pending[0].reject(new Error('provider error'));
    assert.equal((await requests[0]).status, 500);
    assert.equal(active, 2);
    pending[1].resolve(emptyResult);
    pending[2].resolve(emptyResult);
    await Promise.all(requests.slice(1));
    assert.equal(active, 0);
  });
});
