import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { createSharedLimiter } from './shared-limiter.js';
import { createApp } from './app.js';

// Opt in only to an explicitly selected Redis on loopback. Never use the app's
// Redis URL/token, a remote service, or a real analysis provider in these tests.
const configuredPort = process.env.SOPHIA_TEST_REDIS_PORT;
if (configuredPort !== undefined && (!/^[1-9]\d{0,4}$/.test(configuredPort) || Number(configuredPort) > 65_535)) {
  throw new Error('SOPHIA_TEST_REDIS_PORT must be a decimal TCP port between 1 and 65535.');
}
const redisPort = configuredPort === undefined ? undefined : Number(configuredPort);
const integration = { skip: redisPort === undefined ? 'Set SOPHIA_TEST_REDIS_PORT to an isolated local Redis to run Lua integration tests.' : false, timeout: 15_000 };
const incomplete = Symbol('incomplete RESP value');

function parseResp(buffer, start = 0) {
  const end = buffer.indexOf('\r\n', start);
  if (end < 0) return incomplete;
  const kind = String.fromCharCode(buffer[start]);
  const line = buffer.toString('utf8', start + 1, end);
  const next = end + 2;
  if (kind === '+') return { value: line, next };
  if (kind === '-') return { value: new Error(`Local Redis: ${line}`), next };
  if (kind === ':') return { value: Number(line), next };
  if (kind === '$') {
    const length = Number(line);
    if (length === -1) return { value: null, next };
    if (buffer.length < next + length + 2) return incomplete;
    assert.equal(buffer.toString('ascii', next + length, next + length + 2), '\r\n');
    return { value: buffer.toString('utf8', next, next + length), next: next + length + 2 };
  }
  if (kind === '*') {
    const length = Number(line);
    if (length === -1) return { value: null, next };
    const value = [];
    let position = next;
    for (let index = 0; index < length; index++) {
      const item = parseResp(buffer, position);
      if (item === incomplete) return incomplete;
      value.push(item.value);
      position = item.next;
    }
    return { value, next: position };
  }
  throw new Error('Unsupported local Redis response.');
}

// A small RESP2 client keeps the integration suite free of new dependencies.
// One command per socket is sufficient for the isolated EVAL/inspection calls.
function redis(args) {
  assert.ok(redisPort, 'The local Redis integration port must be configured.');
  const parts = [Buffer.from(`*${args.length}\r\n`)];
  for (const argument of args) {
    const bytes = Buffer.from(String(argument));
    parts.push(Buffer.from(`$${bytes.length}\r\n`), bytes, Buffer.from('\r\n'));
  }
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port: redisPort });
    let received = Buffer.alloc(0);
    let finished = false;
    function finish(error, value) {
      if (finished) return;
      finished = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    }
    socket.setTimeout(3000, () => finish(new Error('Local Redis did not respond within three seconds.')));
    socket.once('connect', () => socket.write(Buffer.concat(parts)));
    socket.on('error', (error) => finish(error));
    socket.on('end', () => finish(new Error('Local Redis closed before returning a complete response.')));
    socket.on('data', (data) => {
      try {
        received = Buffer.concat([received, data]);
        assert.ok(received.length < 1_048_576, 'Unexpectedly large local Redis response.');
        const parsed = parseResp(received);
        if (parsed !== incomplete) finish(parsed.value instanceof Error ? parsed.value : null, parsed.value);
      } catch (error) { finish(error); }
    });
  });
}

async function withRedis(run) {
  const prefix = `sophia-test:${randomUUID()}:`;
  const ownedKeys = new Set();
  const commands = [];
  const limiter = () => createSharedLimiter({
    url: 'https://redis-test.invalid', token: 'unused-local-test-token',
    fetchImpl: async (_url, options) => {
      const args = JSON.parse(options.body);
      assert.equal(args[0], 'EVAL', 'Acquisition and release must execute their real Lua scripts.');
      const keyCount = Number(args[2]);
      assert.ok(keyCount === 4 || keyCount === 2, 'Expected four acquisition keys or two release keys.');
      const scopedArgs = [...args];
      const keys = args.slice(3, 3 + keyCount).map((key) => `${prefix}${key}`);
      keys.forEach((key, index) => { ownedKeys.add(key); scopedArgs[index + 3] = key; });
      const command = { args: scopedArgs, keys };
      commands.push(command);
      command.result = await redis(scopedArgs);
      return { ok: true, json: async () => ({ result: command.result }) };
    },
  });
  const acquireCommand = () => commands.findLast((command) => command.keys.length === 4);
  const counters = (keys) => Promise.all(keys.slice(2).map((key) => redis(['GET', key])));
  try { await run({ limiter, commands, acquireCommand, counters }); }
  finally {
    // Delete exactly this test's UUID-prefixed keys, including after failures.
    // Never flush Redis or enumerate/delete another test or application's keys.
    if (ownedKeys.size) await redis(['DEL', ...ownedKeys]);
  }
}

function limited(error, message, maxRetryAfter) {
  assert.equal(error.status, 429);
  assert.equal(error.message, message);
  assert.ok(Number.isSafeInteger(error.retryAfter) && error.retryAfter >= 1 && error.retryAfter <= maxRetryAfter);
  return true;
}

async function expireCounter(key) {
  assert.equal(await redis(['PEXPIRE', key, 1]), 1);
  const deadline = Date.now() + 1000;
  while (await redis(['GET', key]) !== null) {
    assert.ok(Date.now() < deadline, 'The owned test counter should expire promptly.');
    await delay(5);
  }
}

test('real Redis accepts five burst requests across instances and rejects the sixth without incrementing either counter', integration, async () => {
  await withRedis(async ({ limiter, acquireCommand, counters }) => {
    const instances = [limiter(), limiter()];
    for (let index = 0; index < 5; index++) {
      await (await instances[index % 2].acquire('v4:192.0.2.1'))();
      if (index === 0) {
        const burstKey = acquireCommand().keys[2];
        const initialTtl = await redis(['PTTL', burstKey]);
        assert.ok(initialTtl > 590_000 && initialTtl <= 600_000);
        // Shorten an owned counter to detect any later INCR that resets its TTL.
        await redis(['PEXPIRE', burstKey, 30_000]);
      }
    }
    const { keys } = acquireCommand();
    assert.deepEqual(await counters(keys), ['5', '5']);
    const burstTtl = await redis(['PTTL', keys[2]]);
    const dailyTtl = await redis(['PTTL', keys[3]]);
    assert.ok(burstTtl > 0 && burstTtl <= 30_000, 'Accepted requests must retain the first burst window.');
    assert.ok(dailyTtl > 0 && dailyTtl <= 86_400_000);
    await assert.rejects(() => instances[1].acquire('v4:192.0.2.1'), (error) => limited(error, 'Too many analyses. Please try again later.', 600));
    assert.deepEqual(await counters(keys), ['5', '5']);
    assert.ok(await redis(['PTTL', keys[2]]) <= burstTtl);
    assert.ok(await redis(['PTTL', keys[3]]) <= dailyTtl);
    assert.equal(await redis(['ZCARD', keys[0]]), 0);
    assert.equal(await redis(['ZCARD', keys[1]]), 0);
  });
});

test('real Redis preserves a fixed daily window through burst expiries and rejects request 31', integration, async () => {
  await withRedis(async ({ limiter, acquireCommand, counters }) => {
    const instance = limiter();
    let firstDailyTtl;
    for (let batch = 0; batch < 6; batch++) {
      for (let index = 0; index < 5; index++) await (await instance.acquire('v4:192.0.2.2'))();
      const { keys } = acquireCommand();
      if (batch === 0) {
        const initialTtl = await redis(['PTTL', keys[3]]);
        assert.ok(initialTtl > 86_300_000 && initialTtl <= 86_400_000);
        // A shorter owned TTL proves later admissions do not restart the day,
        // without waiting for a 24-hour window or relying on millisecond timing.
        await redis(['PEXPIRE', keys[3], 30_000]);
        firstDailyTtl = await redis(['PTTL', keys[3]]);
      }
      assert.deepEqual(await counters(keys), ['5', String((batch + 1) * 5)]);
      if (batch < 5) await expireCounter(keys[2]);
    }
    const { keys } = acquireCommand();
    await assert.rejects(() => instance.acquire('v4:192.0.2.2'), (error) => limited(error, 'Daily analysis limit reached. Please try again later.', 86_400));
    assert.deepEqual(await counters(keys), ['5', '30'], 'The daily limit takes priority when both windows are exhausted.');
    await expireCounter(keys[2]);
    let retryAfter;
    await assert.rejects(() => instance.acquire('v4:192.0.2.2'), (error) => {
      retryAfter = error.retryAfter;
      return limited(error, 'Daily analysis limit reached. Please try again later.', 86_400);
    });
    assert.deepEqual(acquireCommand().result, [3, retryAfter]);
    assert.deepEqual(await counters(keys), [null, '30']);
    const remaining = await redis(['PTTL', keys[3]]);
    assert.ok(remaining > 0 && remaining <= firstDailyTtl, 'Accepted requests and rejections must not restart the daily window.');
    assert.ok(retryAfter >= Math.ceil(remaining / 1000), 'Daily Retry-After must conservatively cover the remaining window.');
    await expireCounter(keys[3]);
    await (await instance.acquire('v4:192.0.2.2'))();
    assert.deepEqual(await counters(keys), ['1', '1']);
  });
});

test('real Redis enforces two leases per client and three globally, and releases both lease sets', integration, async () => {
  await withRedis(async ({ limiter, acquireCommand, counters, commands }) => {
    const [first, second] = [limiter(), limiter()];
    const [releaseA, releaseB] = await Promise.all([first.acquire('v4:192.0.2.10'), second.acquire('v4:192.0.2.10')]);
    const a = commands[0];
    await assert.rejects(() => first.acquire('v4:192.0.2.10'), (error) => limited(error, 'The analyzer is busy. Please try again shortly.', 10));
    assert.deepEqual(await counters(a.keys), ['2', '2']);
    const releaseC = await second.acquire('v4:192.0.2.11');
    const c = acquireCommand();
    await assert.rejects(() => first.acquire('v4:192.0.2.12'), (error) => limited(error, 'The analyzer is busy. Please try again shortly.', 10));
    assert.deepEqual(await counters(acquireCommand().keys), [null, null]);
    assert.equal(await redis(['ZCARD', a.keys[0]]), 3);
    assert.equal(await redis(['ZCARD', a.keys[1]]), 2);
    const lease = a.args.at(-1);
    const score = Number(await redis(['ZSCORE', a.keys[0], lease]));
    const [seconds, microseconds] = await redis(['TIME']);
    const remaining = score - (Number(seconds) * 1000 + Math.floor(Number(microseconds) / 1000));
    assert.ok(remaining > 315_000 && remaining <= 330_000);
    await releaseA();
    assert.equal(commands.at(-1).result, 2);
    assert.deepEqual(commands.at(-1).keys, a.keys.slice(0, 2));
    assert.equal(await redis(['ZCARD', a.keys[0]]), 2);
    assert.equal(await redis(['ZCARD', a.keys[1]]), 1);
    assert.equal(await redis(['ZSCORE', a.keys[0], lease]), null);
    assert.equal(await redis(['ZSCORE', a.keys[1], lease]), null);
    await releaseA();
    assert.equal(commands.at(-1).result, 0, 'Releasing the same lease again must be harmless.');
    const releaseD = await first.acquire('v4:192.0.2.12');
    const d = acquireCommand();
    await Promise.all([releaseB(), releaseC(), releaseD()]);
    for (const key of [a.keys[0], a.keys[1], c.keys[1], d.keys[1]]) assert.equal(await redis(['ZCARD', key]), 0);
  });
});

test('real Lua removes expired global and client leases before checking available capacity', integration, async () => {
  await withRedis(async ({ limiter, acquireCommand }) => {
    const first = limiter();
    await first.acquire('v4:192.0.2.20');
    const expired = acquireCommand();
    await first.acquire('v4:192.0.2.20');
    const lease = expired.args.at(-1);
    for (const key of expired.keys.slice(0, 2)) await redis(['ZADD', key, 0, lease]);
    const release = await limiter().acquire('v4:192.0.2.20');
    for (const key of expired.keys.slice(0, 2)) {
      assert.equal(await redis(['ZSCORE', key, lease]), null);
      assert.equal(await redis(['ZCARD', key]), 2);
    }
    await release();
  });
});

test('real Lua fails closed on nonexpiring counters or lease sets without changing valid state', integration, async (t) => {
  for (const [keyIndex, name] of ['global leases TTL', 'client leases TTL', 'burst TTL', 'daily TTL'].entries()) await t.test(name, async () => {
    await withRedis(async ({ limiter, acquireCommand, counters }) => {
      const instance = limiter();
      const release = await instance.acquire('v4:192.0.2.30');
      const { keys } = acquireCommand();
      await redis(['PERSIST', keys[keyIndex]]);
      const before = await counters(keys);
      const leases = await Promise.all(keys.slice(0, 2).map((key) => redis(['ZRANGE', key, 0, -1, 'WITHSCORES'])));
      await assert.rejects(() => limiter().acquire('v4:192.0.2.30'), (error) => error.status === 503);
      assert.deepEqual(await counters(keys), before);
      assert.deepEqual(await Promise.all(keys.slice(0, 2).map((key) => redis(['ZRANGE', key, 0, -1, 'WITHSCORES']))), leases);
      assert.equal(await redis(['PTTL', keys[keyIndex]]), -1);
      await release();
    });
  });
});

async function withServers(apps, run) {
  const servers = apps.map((app) => app.listen(0, '127.0.0.1'));
  await Promise.all(servers.map((server) => new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); })));
  try { await run(servers.map((server) => `http://127.0.0.1:${server.address().port}`)); }
  finally {
    for (const server of servers) server.closeAllConnections();
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  }
}

function post(base, ip, extra = {}, body = { type: 'text', content: 'A local test passage.' }) {
  return fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...extra }, body: JSON.stringify(body) });
}

const emptyResult = { claims: [], rhetoric: [], limitations: [] };

test('public HTTP instances share actual Redis quotas by IPv6 /64 and ignore forged administrator headers; admin bypasses them', integration, async () => {
  await withRedis(async ({ limiter, commands }) => {
    const apps = ['public', 'public', 'admin'].map((deployment) => createApp({ deployment, sharedLimiter: limiter(), analyze: async () => emptyResult }));
    await withServers(apps, async ([first, second, admin]) => {
      const spoof = { 'x-sophia-admin': '1', 'x-sophia-client-ip': '203.0.113.4', authorization: 'Bearer forged-test-secret' };
      for (const body of [{ type: 'text', content: 42 }, { type: 'url', content: 'http://127.0.0.1/private' }]) {
        assert.equal((await post(first, '2001:db8::1', spoof, body)).status, 400);
        assert.equal(commands.length, 0, 'Invalid bodies and rejected URLs must fail before any Redis EVAL.');
      }
      for (let index = 0; index < 5; index++) assert.equal((await post(index % 2 ? first : second, `2001:db8::${index + 1}`, spoof)).status, 200);
      const blocked = await post(first, '2001:db8::9', spoof);
      assert.equal(blocked.status, 429);
      assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
      assert.equal((await post(second, '2001:db8:0:1::1', spoof)).status, 200);
      const commandCount = commands.length;
      for (let index = 0; index < 7; index++) assert.equal((await post(admin, '2001:db8::1')).status, 200);
      assert.equal(commands.length, commandCount, 'The administrator deployment must not acquire public quota.');
    });
  });
});

test('public HTTP work holds real leases, releases them after success or failure, and charges admitted failures', integration, async () => {
  await withRedis(async ({ limiter, acquireCommand, counters }) => {
    const pending = [];
    const requests = [];
    const analyze = () => new Promise((resolve, reject) => pending.push({ resolve, reject }));
    const extract = async () => { throw new Error('Deliberate local extraction failure.'); };
    const apps = [createApp({ deployment: 'public', sharedLimiter: limiter(), analyze }), createApp({ deployment: 'public', sharedLimiter: limiter(), analyze, extract })];
    await withServers(apps, async ([first, second]) => {
      async function start(base, ip, expectedCount) {
        const request = post(base, ip);
        requests.push(request);
        const deadline = Date.now() + 2000;
        while (pending.length < expectedCount) {
          assert.ok(Date.now() < deadline, 'The stub analysis must start after acquiring a real lease.');
          await delay(5);
        }
        return acquireCommand();
      }
      try {
        const a = await start(first, '192.0.2.50', 1);
        await start(second, '192.0.2.50', 2);
        assert.equal((await post(first, '192.0.2.50')).status, 429);
        await start(second, '192.0.2.51', 3);
        assert.equal((await post(first, '192.0.2.52')).status, 429);
        assert.equal(await redis(['ZCARD', a.keys[0]]), 3);
        assert.deepEqual(await counters(a.keys), ['2', '2']);
        pending[0].reject(new Error('Deliberate local analysis failure.'));
        assert.equal((await requests[0]).status, 500);
        assert.deepEqual(await counters(a.keys), ['2', '2'], 'An admitted provider failure must remain charged to both quota windows.');
        assert.equal(await redis(['ZCARD', a.keys[0]]), 2);
        assert.equal(await redis(['ZCARD', a.keys[1]]), 1);
        await start(first, '192.0.2.52', 4);
        for (const request of pending.slice(1)) request.resolve(emptyResult);
        for (const response of await Promise.all(requests.slice(1))) assert.equal(response.status, 200);
        assert.equal(await redis(['ZCARD', a.keys[0]]), 0);
        assert.equal(await redis(['ZCARD', a.keys[1]]), 0);
        const extractionFailure = await post(second, '192.0.2.53', {}, { type: 'url', content: 'https://example.org/local-test-article' });
        assert.equal(extractionFailure.status, 500);
        const extracted = acquireCommand();
        assert.deepEqual(await counters(extracted.keys), ['1', '1'], 'An admitted extraction failure must remain charged to both quota windows.');
        assert.equal(await redis(['ZCARD', extracted.keys[0]]), 0);
        assert.equal(await redis(['ZCARD', extracted.keys[1]]), 0);
        assert.equal(pending.length, 4, 'An extraction failure must not start the analysis provider.');
      } finally {
        for (const request of pending) request.resolve(emptyResult);
        await Promise.allSettled(requests);
      }
    });
  });
});
