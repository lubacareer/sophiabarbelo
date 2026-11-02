import test from 'node:test';
import assert from 'node:assert/strict';
import { requestJson } from './research-http.js';
import { localize } from './localization.js';
import { createDeadline } from './deadline.js';
import { AppError } from './errors.js';

const request = (fetchImpl, extra = {}) => requestJson('https://provider.example/fixed-endpoint', { headers: { authorization: 'Bearer private-test-key' }, body: {}, fetchImpl, logger: () => {}, ...extra });

test('upstream warnings contain only a fixed provider hostname and numeric status without reading error bodies', async () => {
  const logs = [];
  for (const url of [
    'https://generativelanguage.googleapis.com/v1beta/interactions?key=private-test-key',
    'https://api.cloudflare.com/client/v4/accounts/private-account-id/ai/v1/chat/completions',
    'https://api.tavily.com/search',
  ]) {
    await assert.rejects(() => requestJson(url, {
      headers: { authorization: 'Bearer private-test-key', 'x-goog-api-key': 'private-test-key' },
      body: { input: 'private source text', project: 'private-project-id' },
      logger: (...items) => logs.push(items),
      fetchImpl: async () => ({ ok: false, status: 400, json: async () => { assert.fail('Upstream error bodies must remain unread'); } }),
    }), (error) => error.status === 502);
    assert.deepEqual(logs.at(-1), ['Analysis provider returned an error.', { provider: new URL(url).hostname, status: 400 }]);
  }
  assert.equal(logs.length, 3);
  assert.doesNotMatch(JSON.stringify(logs), /private|\/v1|\/search|key=|account-id|project-id/);
  await assert.rejects(() => requestJson('https://private-project-id.example/path', {
    body: {}, headers: {}, logger: (...items) => logs.push(items), fetchImpl: async () => ({ ok: false, status: 500 }),
  }), (error) => error.status === 502);
  assert.equal(logs.length, 3, 'An unexpected hostname must not be copied into logs.');
});

test('successful responses are not warned and a failing logger cannot replace the provider error', async () => {
  assert.deepEqual(await requestJson('https://api.tavily.com/search', {
    body: {}, headers: {}, logger: () => { assert.fail('Successful responses need no warning'); },
    fetchImpl: async () => ({ ok: true, json: async () => ({ results: [] }) }),
  }), { results: [] });
  await assert.rejects(() => requestJson('https://generativelanguage.googleapis.com/v1beta/interactions', {
    body: {}, headers: {}, logger: () => { throw new Error('private logger detail'); },
    fetchImpl: async () => ({ ok: false, status: 401 }),
  }), (error) => error.status === 503 && /credentials are invalid/.test(error.message) && !error.message.includes('private'));
});

test('provider HTTP failures use safe localized messages and bounded Retry-After without retries', async () => {
  for (const [status, expected] of [[401, 503], [403, 503], [402, 503], [429, 429], [432, 503], [434, 503], [413, 413], [500, 502]]) {
    let calls = 0;
    await assert.rejects(() => request(async () => {
      calls++;
      return { ok: false, status, headers: new Headers({ 'retry-after': '2.1' }), json: async () => { throw new Error('Do not read or disclose private provider details'); } };
    }), (error) => {
      assert.equal(error.status, expected);
      assert.doesNotMatch(error.message, /private|key|token/);
      assert.notEqual(localize(error.message, 'he'), error.message);
      assert.notEqual(localize(error.message, 'ru'), error.message);
      if ([402, 429, 432, 434].includes(status)) assert.equal(error.retryAfter, 3);
      return true;
    });
    assert.equal(calls, 1);
  }
  for (const value of ['private arbitrary header', '-2', 'Infinity', '999999999999999999999999']) {
    await assert.rejects(() => request(async () => ({ ok: false, status: 429, headers: new Headers({ 'retry-after': value }) })), (error) => error.retryAfter === undefined);
  }
});

test('HTTP-date Retry-After is converted to a positive integer without forwarding arbitrary headers', async () => {
  await assert.rejects(() => request(async () => ({ ok: false, status: 429, headers: new Headers({ 'retry-after': new Date(Date.now() + 60_000).toUTCString(), 'x-private': 'must not escape' }) })), (error) => error.retryAfter >= 59 && error.retryAfter <= 60 && error.headers === undefined);
});

test('network errors, malformed JSON and already-aborted requests never expose provider details', async () => {
  for (const fetchImpl of [async () => { throw new Error('private transport detail'); }, async () => ({ ok: true, json: async () => { throw new Error('private JSON detail'); } })]) {
    await assert.rejects(() => request(fetchImpl), (error) => error.status === 502 && !error.message.includes('private'));
  }
  const controller = new AbortController();
  controller.abort(new Error('private abort detail'));
  await assert.rejects(() => request(async () => { assert.fail('Aborted work must never start'); }, { signal: controller.signal }), (error) => error.status === 502 && !error.message.includes('private'));
});

test('reading a stalled provider response remains within the shared abort deadline', async () => {
  const controller = new AbortController();
  let reading;
  const started = new Promise((resolve) => { reading = resolve; });
  const work = request(async () => ({ ok: true, json: async () => { reading(); return new Promise(() => {}); } }), { signal: controller.signal });
  await started;
  const rejected = assert.rejects(work, (error) => error.status === 502);
  controller.abort();
  await rejected;
});

test('shared request expiry aborts fetch and body waits with a safe 504', async () => {
  for (const phase of ['fetch', 'body']) {
    let expire;
    const deadline = createDeadline(280_000, { setTimer: (callback) => { expire = callback; return 1; }, clearTimer: () => {} });
    let started;
    const ready = new Promise((resolve) => { started = resolve; });
    let signal;
    const work = request(async (_url, options) => {
      signal = options.signal;
      if (phase === 'fetch') { started(); return new Promise(() => {}); }
      return { ok: true, json: async () => { started(); return new Promise(() => {}); } };
    }, { deadline });
    try {
      await ready;
      const rejected = assert.rejects(work, (error) => error.status === 504 && error.message === 'The analysis took too long. Please try again.');
      expire();
      await rejected;
      assert.equal(signal.aborted, true);
    } finally { deadline.dispose(); }
  }
});

test('a body that finishes after absolute expiry cannot return a late success before timers run', async () => {
  let clock = 0;
  const deadline = createDeadline(280_000, { now: () => clock, setTimer: () => 1, clearTimer: () => {} });
  try {
    await assert.rejects(() => request(async () => ({ ok: true, json: async () => { clock = 280_000; return { result: 'late' }; } }), { deadline }), (error) => error.status === 504);
  } finally { deadline.dispose(); }
});

test('external AppError cancellation messages cannot escape as deadline errors', async () => {
  const controller = new AbortController();
  const deadline = createDeadline(280_000, { signal: controller.signal });
  controller.abort(new AppError(504, 'private cancellation detail'));
  try {
    await assert.rejects(() => request(async () => assert.fail('Cancelled work must not start'), { deadline }), (error) => error.status === 504 && error.message === 'The analysis took too long. Please try again.');
  } finally { deadline.dispose(); }
});

test('per-call inference timeouts return safe 504s while search timeouts retain their research error', async (t) => {
  let controller;
  t.mock.method(AbortSignal, 'timeout', () => controller.signal);
  for (const research of [false, true]) for (const phase of ['fetch', 'body']) for (const stage of ['query', 'analysis']) {
    controller = new AbortController();
    const logs = [];
    let started;
    let calls = 0;
    const ready = new Promise((resolve) => { started = resolve; });
    const work = requestJson('https://api.cloudflare.com/client/v4/accounts/private-account/ai/v1/chat/completions', {
      headers: {}, body: {}, stage, research, logger: (...items) => logs.push(items),
      fetchImpl: async () => {
        calls++;
        if (phase === 'fetch') { started(); return new Promise(() => {}); }
        return { ok: true, json: async () => { started(); return new Promise(() => {}); } };
      },
    });
    await ready;
    const rejected = assert.rejects(work, (error) => error.status === (research ? 503 : 504) && !error.message.includes('private'));
    controller.abort(new Error('private timeout reason'));
    await rejected;
    assert.equal(calls, 1, 'Timeouts must not retry or start another model.');
    assert.equal(logs[0][0], 'Analysis provider request failed.');
    assert.equal(logs[0][1].provider, 'api.cloudflare.com');
    assert.equal(logs[0][1].stage, stage);
    assert.equal(logs[0][1].phase, phase);
    assert.equal(logs[0][1].failure, 'timeout');
    assert.ok(Number.isInteger(logs[0][1].elapsedMs));
    assert.doesNotMatch(JSON.stringify(logs), /private|reason|accounts/);
  }
});

test('shared and research expiry log timeout for both inference stages and I/O phases', async () => {
  for (const budget of ['request', 'research']) for (const stage of ['query', 'analysis']) for (const phase of ['fetch', 'body']) {
    let clock = 0, expireParent, expireResearch;
    const parent = createDeadline(280_000, { now: () => clock, setTimer: (callback) => { expireParent = callback; return 1; }, clearTimer: () => {} });
    if (budget === 'request') clock = 250_000;
    const deadline = createDeadline(240_000, { parent, now: () => clock, setTimer: (callback) => { expireResearch = callback; return 1; }, clearTimer: () => {} });
    let started;
    const ready = new Promise((resolve) => { started = resolve; });
    const logs = [];
    const work = requestJson('https://api.cloudflare.com/client/v4/accounts/private-account/ai/v1/chat/completions', {
      headers: { authorization: 'Bearer private-key' }, body: { input: 'private passage' }, deadline, stage,
      logger: (...items) => logs.push(items),
      fetchImpl: async () => {
        if (phase === 'fetch') { started(); return new Promise(() => {}); }
        return { ok: true, json: async () => { started(); return new Promise(() => {}); } };
      },
    });
    try {
      await ready;
      const rejected = assert.rejects(work, (error) => error.status === 504 && error.message === 'The analysis took too long. Please try again.');
      clock = budget === 'request' ? 280_000 : 240_000;
      (budget === 'request' ? expireParent : expireResearch)();
      await rejected;
      assert.equal(logs.length, 1);
      assert.equal(logs[0][1].failure, 'timeout');
      assert.equal(logs[0][1].stage, stage);
      assert.equal(logs[0][1].phase, phase);
      assert.doesNotMatch(JSON.stringify(logs), /private|reason|accounts|passage|Bearer/);
    } finally { deadline.dispose(); parent.dispose(); }
  }
});

test('absolute deadline expiry wins over a late transport error and is diagnosed as timeout', async () => {
  for (const phase of ['fetch', 'body']) {
    let clock = 0;
    const deadline = createDeadline(280_000, { now: () => clock, setTimer: () => 1, clearTimer: () => {} });
    const logs = [];
    const lateFailure = () => { clock = 280_000; throw Object.assign(new Error('private transport failure'), { code: 'ECONNRESET' }); };
    try {
      await assert.rejects(() => requestJson('https://generativelanguage.googleapis.com/v1beta/interactions', {
        headers: {}, body: {}, deadline, stage: 'analysis', logger: (...items) => logs.push(items),
        fetchImpl: async () => phase === 'fetch' ? lateFailure() : { ok: true, json: async () => lateFailure() },
      }), (error) => error.status === 504);
      assert.equal(logs[0][1].failure, 'timeout');
      assert.equal(logs[0][1].phase, phase);
      assert.equal(logs[0][1].code, 'ECONNRESET');
      assert.doesNotMatch(JSON.stringify(logs), /private/);
    } finally { deadline.dispose(); }
  }
});

test('external cancellation stays cancelled even when its private reason resembles a timeout', async () => {
  for (const stage of ['query', 'analysis']) for (const phase of ['fetch', 'body']) for (const status of [undefined, 504]) {
    const controller = new AbortController();
    const parent = createDeadline(280_000, { signal: controller.signal, now: () => 0, setTimer: () => 1, clearTimer: () => {} });
    const deadline = createDeadline(240_000, { parent, now: () => 0, setTimer: () => 1, clearTimer: () => {} });
    let started;
    const ready = new Promise((resolve) => { started = resolve; });
    const logs = [];
    const work = requestJson('https://api.cloudflare.com/fixed', {
      headers: {}, body: {}, deadline, stage, logger: (...items) => logs.push(items),
      fetchImpl: async () => {
        if (phase === 'fetch') { started(); return new Promise(() => {}); }
        return { ok: true, json: async () => { started(); return new Promise(() => {}); } };
      },
    });
    try {
      await ready;
      const rejected = assert.rejects(work, (error) => error.status === (status || 502) && !error.message.includes('private'));
      controller.abort(status ? new AppError(status, 'private external timeout-like reason') : new Error('private external abort'));
      await rejected;
      assert.equal(logs[0][1].failure, 'cancelled');
      assert.equal(logs[0][1].stage, stage);
      assert.equal(logs[0][1].phase, phase);
      assert.doesNotMatch(JSON.stringify(logs), /private|reason|stack/);
    } finally { deadline.dispose(); parent.dispose(); }
  }
});

test('transport diagnostics allowlist provider, stage and error codes without logging error details', async () => {
  const logs = [];
  for (const code of ['ENOTFOUND', 'private-code']) {
    await assert.rejects(() => requestJson('https://api.cloudflare.com/client/v4/accounts/private-id/ai/v1/chat/completions?key=private-key', {
      headers: { authorization: 'Bearer private-key' }, body: { input: 'private text' }, stage: code === 'ENOTFOUND' ? 'query' : 'private-stage', logger: (...items) => logs.push(items),
      fetchImpl: async () => { throw Object.assign(new Error('private error message'), { cause: { code, stack: 'private stack', detail: 'private account' } }); },
    }), (error) => error.status === 502);
  }
  assert.equal(logs[0][1].code, 'ENOTFOUND');
  assert.equal(logs[0][1].stage, 'query');
  assert.equal(logs[0][1].failure, 'transport');
  assert.equal(logs[1][1].code, undefined);
  assert.equal(logs[1][1].stage, undefined);
  assert.doesNotMatch(JSON.stringify(logs), /private|Bearer|stack|account|input|key=/);
  await assert.rejects(() => requestJson('https://api.cloudflare.com/fixed', { headers: {}, body: {}, logger: () => { throw new Error('private logger'); }, fetchImpl: async () => { throw new Error('private transport'); } }), (error) => error.status === 502 && !error.message.includes('private'));
});
