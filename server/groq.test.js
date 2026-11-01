import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithGroq } from './groq.js';
import { createApp } from './app.js';

const sourceText = 'The river rose last year. Everyone knows who is to blame.';
const analysis = {
  claims: [
    { excerpt: 'The river rose last year.', claim: 'The river rose', status: 'supported', explanation: 'The reports confirm it.', sources: [
      { title: 'Search report', url: 'https://example.org/report#section' },
      { title: 'Browser report', url: 'https://example.org/browser' },
      { title: 'Invented', url: 'https://example.org/invented' },
    ] },
    { excerpt: 'Everyone knows who is to blame.', claim: 'Blame', status: 'contradicted', explanation: 'An unsupported assertion.', sources: [{ title: 'Invented', url: 'https://example.org/invented' }] },
    { excerpt: 'Never in the original', claim: 'Fake', status: 'supported', explanation: 'Fake', sources: [] },
  ],
  rhetoric: [
    { category: 'Scapegoating', excerpt: 'Everyone knows who is to blame.', explanation: 'It implies shared blame.' },
    { category: 'Invalid', excerpt: 'Not in the text', explanation: 'Invalid.' },
  ],
  limitations: ['Sources may be incomplete.'],
};

function completion(message) {
  return { ok: true, json: async () => ({ choices: [{ message }] }) };
}

test('Groq researches and structures separately, preserving only provider-cited links and real excerpts', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, headers: options.headers, body: JSON.parse(options.body) });
    if (requests.length === 1) return completion({
      content: 'Evidence includes https://example.org/report, https://example.org/browser and https://example.org/invented.',
      executed_tools: [{
        search_results: { results: [{ title: 'Search report', url: 'https://example.org/report' }] },
        browser_results: [{ title: 'Browser report', url: 'https://example.org/browser' }],
      }],
    });
    return completion({ content: JSON.stringify(analysis) });
  };
  const actual = await analyzeWithGroq(sourceText, { apiKey: 'test-key', fetchImpl });
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(request.body.model, 'openai/gpt-oss-120b');
    assert.equal(request.headers.authorization, 'Bearer test-key');
  }
  assert.deepEqual(requests[0].body.tools, [{ type: 'browser_search' }]);
  assert.equal(requests[0].body.tool_choice, 'required');
  assert.equal(requests[0].body.response_format, undefined);
  assert.equal(requests[1].body.tools, undefined);
  assert.equal(requests[1].body.response_format.type, 'json_schema');
  assert.equal(requests[1].body.response_format.json_schema.strict, true);
  assert.equal(actual.claims.length, 2);
  assert.deepEqual(actual.claims[0].sources, [
    { title: 'Search report', url: 'https://example.org/report' },
    { title: 'Browser report', url: 'https://example.org/browser' },
  ]);
  assert.equal(actual.claims[0].status, 'supported');
  assert.equal(actual.claims[1].status, 'unverified');
  assert.deepEqual(actual.claims[1].sources, []);
  assert.equal(actual.rhetoric.length, 1);
});

test('Groq does not treat model-generated URLs as provider citations', async () => {
  let count = 0;
  const fetchImpl = async () => ++count === 1
    ? completion({ content: 'The source is https://example.org/report.' })
    : completion({ content: JSON.stringify(analysis) });
  const actual = await analyzeWithGroq(sourceText, { apiKey: 'test-key', fetchImpl });
  assert.equal(actual.claims[0].status, 'unverified');
  assert.deepEqual(actual.claims[0].sources, []);
});

test('Groq reports missing credentials and upstream failures safely at either stage', async () => {
  await assert.rejects(() => analyzeWithGroq('hello', { apiKey: '' }), /configure GROQ_API_KEY/);
  await assert.rejects(() => analyzeWithGroq('hello', { apiKey: 'secret', fetchImpl: async () => ({ ok: false, status: 401 }) }), /credentials are invalid/);
  await assert.rejects(() => analyzeWithGroq('hello', { apiKey: 'secret', fetchImpl: async () => { throw new Error('secret'); } }), /could not be reached/);
  let calls = 0;
  await assert.rejects(() => analyzeWithGroq('hello', {
    apiKey: 'secret', fetchImpl: async () => ++calls === 1 ? completion({ content: 'No useful sources.', executed_tools: [] }) : { ok: false, status: 429 },
  }), /limit|busy/i);
  assert.equal(calls, 2);
});

test('local Groq honors an explicitly configured GROQ_MODEL', async () => {
  const previousModel = process.env.GROQ_MODEL;
  process.env.GROQ_MODEL = 'configured-model';
  try {
    const models = [];
    const fetchImpl = async (_url, options) => {
      models.push(JSON.parse(options.body).model);
      return completion({ content: models.length === 1 ? 'Research' : JSON.stringify(analysis), executed_tools: [] });
    };
    await analyzeWithGroq(sourceText, { apiKey: 'test', fetchImpl });
    assert.deepEqual(models, ['configured-model', 'configured-model']);
  } finally {
    if (previousModel === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = previousModel;
  }
});

test('Groq supports an explicit model override and rejects malformed analysis', async () => {
  const models = [];
  const fetchImpl = async (_url, options) => {
    models.push(JSON.parse(options.body).model);
    return completion({ content: models.length === 1 ? 'Research' : 'not JSON', executed_tools: [] });
  };
  await assert.rejects(() => analyzeWithGroq('hello', { apiKey: 'test', model: 'custom-model', fetchImpl }), /incomplete result/);
  assert.deepEqual(models, ['custom-model', 'custom-model']);
});

test('Groq rejects truncated responses at either stage', async () => {
  for (const truncateStage of [1, 2]) {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return { ok: true, json: async () => ({ choices: [{ message: { content: calls === 1 ? 'Research' : JSON.stringify(analysis) }, finish_reason: calls === truncateStage ? 'length' : 'stop' }] }) };
    };
    await assert.rejects(() => analyzeWithGroq(sourceText, { apiKey: 'test', fetchImpl }), /incomplete result/);
    assert.equal(calls, truncateStage);
  }
});

test('Groq retries only the rate-limited stage using the provider delay', async () => {
  const calls = [];
  const delays = [];
  const fetchImpl = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    if (calls.length === 1) return completion({ content: 'Research', executed_tools: [] });
    if (calls.length === 2) return { ok: false, status: 429, headers: new Headers({ 'retry-after': '2' }) };
    return completion({ content: JSON.stringify(analysis) });
  };
  await analyzeWithGroq(sourceText, { apiKey: 'test', fetchImpl, sleepImpl: async (ms) => delays.push(ms) });
  assert.deepEqual(delays, [2000]);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[1], calls[2]);
  assert.deepEqual(calls[0].tools, [{ type: 'browser_search' }]);
});

test('Groq returns a clear limit error instead of waiting excessively or retrying oversized input', async () => {
  let slept = false;
  const options = { apiKey: 'test', sleepImpl: async () => { slept = true; } };
  await assert.rejects(() => analyzeWithGroq(sourceText, { ...options, fetchImpl: async () => ({ ok: false, status: 429, headers: new Headers({ 'retry-after': '60' }) }) }),
    (error) => error.status === 429 && error.retryAfter === 60 && /60 seconds/.test(error.message));
  await assert.rejects(() => analyzeWithGroq(sourceText, { ...options, fetchImpl: async () => ({ ok: false, status: 413 }) }),
    (error) => error.status === 413 && /shorter text/.test(error.message));
  assert.equal(slept, false);
});

test('Groq does not sleep when the provider delay exceeds the configured retry budget', async () => {
  let slept = false;
  let calls = 0;
  await assert.rejects(() => analyzeWithGroq(sourceText, {
    apiKey: 'test', maxRetryWaitSeconds: 15,
    sleepImpl: async () => { slept = true; },
    fetchImpl: async () => { calls++; return { ok: false, status: 429, headers: new Headers({ 'retry-after': '16' }) }; },
  }), (error) => error.status === 429 && error.retryAfter === 16);
  assert.equal(slept, false);
  assert.equal(calls, 1);
});

test('Groq shares its retry wait budget across research and analysis', async () => {
  const delays = [];
  let calls = 0;
  await assert.rejects(() => analyzeWithGroq(sourceText, {
    apiKey: 'test', maxRetryWaitSeconds: 15,
    sleepImpl: async (ms) => delays.push(ms),
    fetchImpl: async () => {
      calls++;
      if (calls === 1) return { ok: false, status: 429, headers: new Headers({ 'retry-after': '10' }) };
      if (calls === 2) return completion({ content: 'Research', executed_tools: [] });
      return { ok: false, status: 429, headers: new Headers({ 'retry-after': '6' }) };
    },
  }), (error) => error.status === 429 && error.retryAfter === 6);
  assert.deepEqual(delays, [10000]);
  assert.equal(calls, 3);
});

test('default app uses xAI and rejects unsupported provider configuration', async () => {
  const previousProvider = process.env.ANALYSIS_PROVIDER;
  const previousKey = process.env.XAI_API_KEY;
  delete process.env.ANALYSIS_PROVIDER;
  delete process.env.XAI_API_KEY;
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = async () => {
      const res = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'text', content: 'A claim' }) });
      return { status: res.status, body: await res.json() };
    };
    assert.deepEqual(await post(), { status: 503, body: { error: 'Analysis is unavailable: configure XAI_API_KEY on the server.' } });
    process.env.ANALYSIS_PROVIDER = 'unsupported';
    assert.deepEqual(await post(), { status: 503, body: { error: 'Analysis is unavailable: configure ANALYSIS_PROVIDER as groq or xai.' } });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previousProvider === undefined) delete process.env.ANALYSIS_PROVIDER;
    else process.env.ANALYSIS_PROVIDER = previousProvider;
    if (previousKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = previousKey;
  }
});
