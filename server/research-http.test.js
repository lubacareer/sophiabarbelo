import test from 'node:test';
import assert from 'node:assert/strict';
import { requestJson } from './research-http.js';
import { localize } from './localization.js';

const request = (fetchImpl, extra = {}) => requestJson('https://provider.example/fixed-endpoint', { headers: { authorization: 'Bearer private-test-key' }, body: {}, fetchImpl, ...extra });

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
