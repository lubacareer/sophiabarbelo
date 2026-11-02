import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithGrok, validatedResult } from './grok.js';
import { createDeadline } from './deadline.js';
import { AppError } from './errors.js';
import { createApp } from './app.js';
import { modelEnvironment } from '../test-support/models.js';

const empty = () => ({ claims: [], rhetoric: [], limitations: [] });
const message = (text, extra = {}) => ({ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text }], ...extra });
const envelope = (...output) => ({ status: 'completed', output });
const run = (provider, options = {}) => analyzeWithGrok('The moon reflects light.', {
  apiKey: 'private-key', logger: () => {},
  fetchImpl: async () => ({ ok: true, json: async () => provider }), ...options,
});
const incomplete = (error) => error.status === 502 && error.message === 'The analysis service returned an incomplete result. Please try again.';

test('Grok uses the final assistant answer and joins text fragments without changing multilingual JSON', async () => {
  for (const excerpt of ['The moon reflects light.', 'הירח משקף אור.', 'Луна отражает свет.']) {
    const result = { ...empty(), symbolicReadings: [{ excerpt, title: excerpt, reading: excerpt, reflectionQuestion: excerpt, basis: 'reflection', tradition: '', sources: [] }] };
    const serialized = JSON.stringify(result);
    const split = serialized.indexOf(excerpt) + 2;
    let calls = 0;
    const actual = await analyzeWithGrok(excerpt, {
      apiKey: 'test', includeSymbolicReadings: true, logger: () => {},
      fetchImpl: async () => {
        calls++;
        return { ok: true, json: async () => envelope(
          message('I will research the passage.'),
          { type: 'web_search_call', status: 'completed' },
          message('', { content: [
            { type: 'output_text', text: serialized.slice(0, split) },
            { type: 'output_text', text: serialized.slice(split) },
          ] }),
          { type: 'reasoning', status: 'completed' },
          message('Not an assistant answer', { role: 'tool' }),
        ) };
      },
    });
    assert.deepEqual(actual, result);
    assert.equal(calls, 1);
  }
});

test('Grok never reuses an earlier valid answer when the final answer is refused or malformed', async () => {
  const valid = message(JSON.stringify(empty()));
  for (const final of [
    message('not JSON'),
    message(JSON.stringify({ claims: [] })),
    message('', { content: [{ type: 'refusal', refusal: 'private refusal' }] }),
    message('', { content: [{ type: 'output_text', text: JSON.stringify(empty()) }, { type: 'refusal', refusal: 'private refusal' }] }),
    message('', { content: [] }),
    message('', { content: null }),
    message('', { content: [{ type: 'output_text', text: null }] }),
  ]) await assert.rejects(() => run(envelope(valid, final)), incomplete);
});

test('Grok rejects unsuccessful response and final-message statuses even with complete JSON', async () => {
  for (const status of ['incomplete', 'in_progress', 'failed', 'cancelled', 'private-unknown-status', null]) {
    await assert.rejects(() => run({ ...envelope(message(JSON.stringify(empty()))), status }), incomplete);
    await assert.rejects(() => run(envelope(message(JSON.stringify(empty()), { status }))), incomplete);
  }
  await assert.rejects(() => run({ ...envelope(message(JSON.stringify(empty()))), error: { message: 'private error' } }), incomplete);
  await assert.rejects(() => run(envelope({ type: 'reasoning' })), incomplete);
  for (const provider of [null, {}, { output: {} }]) await assert.rejects(() => run(provider), incomplete);
  assert.deepEqual(await run({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(empty()) }] }] }), empty());
});

test('malformed citation metadata is ignored without trusting invented or unsafe source URLs', () => {
  const source = { title: 'Report', url: 'https://example.org/report' };
  const claim = { excerpt: 'The moon reflects light.', claim: 'Reflected light', status: 'supported', explanation: 'Reported.', sources: [source, { title: 'Invented', url: 'https://example.org/invented' }, { title: 'Unsafe', url: 'javascript:private' }] };
  const raw = { ...empty(), claims: [claim] };
  const metadata = {
    citations: { private: 'not an array' },
    output: [null, { content: {} }, { content: [null, { annotations: {} }, { annotations: [null, { url_citation: source }, { url: 'javascript:private' }] }] }],
  };
  assert.deepEqual(validatedResult(raw, metadata, claim.excerpt).claims[0].sources, [source]);
  for (const provider of [undefined, { citations: 'private', output: {} }, { citations: [null], output: [{ content: [{ annotations: 'private' }] }] }]) {
    const actual = validatedResult(raw, provider, claim.excerpt).claims[0];
    assert.equal(actual.status, 'unverified');
    assert.deepEqual(actual.sources, []);
    assert.match(actual.explanation, /No independently cited evidence/);
  }
});

test('Grok diagnostics distinguish body reads, JSON parsing, and schema validation without private details', async () => {
  const cases = [
    { provider: envelope(message('private invalid JSON https://private.example/')), phase: 'parse', reason: 'invalid_json' },
    { provider: envelope(message(JSON.stringify(empty()))), options: { includeSymbolicReadings: true }, phase: 'validation', reason: 'invalid_shape', invalidArrays: ['symbolicReadings'] },
    { provider: envelope(message(JSON.stringify({ claims: null, rhetoric: 'private', limitations: [], 'private-field-name': 'private' }))), phase: 'validation', reason: 'invalid_shape', invalidArrays: ['claims', 'rhetoric'] },
    { provider: { ...envelope(message(JSON.stringify(empty()))), status: 'private-status' }, phase: 'response', reason: 'response_status' },
    { provider: envelope(message('', { content: [{ type: 'refusal', refusal: 'private refusal' }] })), phase: 'response', reason: 'refusal' },
    { options: { fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('private body read'); } }) }, phase: 'body', reason: 'body_read' },
    { options: { fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('private invalid body JSON'); } }) }, phase: 'body', reason: 'invalid_json' },
  ];
  for (const { provider, options, phase, reason, invalidArrays } of cases) {
    const logs = [];
    await assert.rejects(() => run(provider, { ...options, logger: (...args) => logs.push(args) }), incomplete);
    assert.equal(logs.length, 1);
    assert.equal(logs[0][1].phase, phase);
    assert.equal(logs[0][1].reason, reason);
    assert.deepEqual(logs[0][1].invalidArrays, invalidArrays);
    assert.doesNotMatch(JSON.stringify(logs), /private|https:/);
    assert.ok(Object.keys(logs[0][1]).every((key) => ['phase', 'reason', 'invalidArrays', 'responseStatus', 'messageStatus', 'outputCount', 'messageCount', 'textBlockCount'].includes(key)));
  }
});

test('Grok timeout diagnostics preserve request caps, shared-deadline precedence, and external cancellation', async (t) => {
  for (const phase of ['fetch', 'body']) for (const cause of ['timeout', 'deadline', 'external']) {
    const timeout = new AbortController();
    const external = new AbortController();
    const timeouts = [];
    const mock = t.mock.method(AbortSignal, 'timeout', (ms) => { timeouts.push(ms); return timeout.signal; });
    let now = 0;
    let expire;
    const deadline = createDeadline(100, { signal: external.signal, now: () => now, setTimer: (fn) => { expire = fn; return 0; }, clearTimer: () => {} });
    const started = Promise.withResolvers();
    const logs = [];
    let calls = 0;
    let transportSignal;
    const block = () => { started.resolve(); return new Promise(() => {}); };
    try {
      const work = run(undefined, {
        deadline, signal: external.signal, logger: (...args) => logs.push(args),
        fetchImpl: async (_url, options) => {
          calls++;
          transportSignal = options.signal;
          return phase === 'fetch' ? block() : { ok: true, json: block };
        },
      });
      await started.promise;
      const rejected = assert.rejects(work, (error) => error.status === 504 && error.message === 'The analysis took too long. Please try again.');
      if (cause === 'timeout') timeout.abort(new Error('private timeout'));
      if (cause === 'deadline') { now = 101; expire(); timeout.abort(new Error('private concurrent cap')); }
      // A caller-provided 504 remains sanitized by the shared deadline helper,
      // but diagnostics must distinguish it from actual absolute expiry.
      if (cause === 'external') { external.abort(new AppError(504, 'private cancellation')); timeout.abort(new Error('private later timeout')); }
      await rejected;
      assert.equal(transportSignal.aborted, true);
      assert.equal(calls, 1);
      assert.deepEqual(timeouts, [120_000]);
      assert.equal(logs.length, 1);
      assert.deepEqual(logs[0][1], { phase, reason: cause === 'external' ? 'cancelled' : cause });
      assert.doesNotMatch(JSON.stringify(logs), /private/);
    } finally { deadline.dispose(); mock.mock.restore(); }
  }
});

test('public Grok request-cap expiry returns a localized 504 and releases its lease once', async (t) => {
  const expectedTimeoutBodies = {
    en: 'The analysis took too long. Please try again.',
    he: 'הניתוח נמשך זמן רב מדי. יש לנסות שוב.',
    ru: 'Анализ занял слишком много времени. Повторите попытку.',
  };
  for (const phase of ['fetch', 'body']) for (const language of ['en', 'he', 'ru']) {
    const cap = new AbortController();
    const mock = t.mock.method(AbortSignal, 'timeout', () => cap.signal);
    let acquisitions = 0, releases = 0, providerCalls = 0;
    const logs = [];
    const expire = () => { cap.abort(new Error('private provider timeout')); return new Promise(() => {}); };
    const app = createApp({
      deployment: 'public', modelEnvironment,
      sharedLimiter: { acquire: async () => { acquisitions++; return async () => { releases++; }; } },
      analyze: async (text, options) => {
        assert.equal(options.modelId, 'grok-4.7');
        assert.equal(options.includeSymbolicReadings, true);
        return analyzeWithGrok(text, { ...options, apiKey: 'private-key', logger: (...args) => logs.push(args), fetchImpl: async () => {
          providerCalls++;
          return phase === 'fetch' ? expire() : { ok: true, json: expire };
        } });
      },
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/analyze`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '8.8.8.8' },
        body: JSON.stringify({ type: 'text', content: 'הירח משקף אור.', modelId: 'grok-4.7', language, includeSymbolicReadings: true }),
      });
      assert.equal(response.status, 504);
      assert.deepEqual(await response.json(), { error: expectedTimeoutBodies[language] });
      assert.deepEqual([acquisitions, releases, providerCalls], [1, 1, 1]);
      assert.deepEqual(logs, [['Grok analysis request failed.', { phase, reason: 'timeout' }]]);
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      mock.mock.restore();
    }
  }
});

test('Grok diagnostics cannot replace the safe public failure when a logger throws', async () => {
  await assert.rejects(() => run(envelope(message('invalid')), { logger: () => { throw new Error('private logger failure'); } }), incomplete);
});
