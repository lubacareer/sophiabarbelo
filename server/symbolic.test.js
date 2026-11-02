import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { analysisConfiguration, analyzeConfigured } from './provider.js';
import { schema, validatedResult, analyzeWithGrok } from './grok.js';
import { analyzeWithGroq } from './groq.js';
import { analyzeWithOpenAI } from './openai.js';
import { analyzeWithGemini } from './gemini.js';
import { analyzeWithCloudflare } from './cloudflare.js';
import { symbolicSchema } from './symbolic.js';
import { localize } from './localization.js';
import { modelEnvironment } from '../test-support/models.js';

const original = 'The moon reflects light. הירח משקף אור. Луна отражает свет.';
const citation = 'https://example.org/tradition';
const empty = () => ({ claims: [], rhetoric: [], limitations: [] });
const reading = (overrides = {}) => ({ excerpt: 'The moon reflects light.', title: 'A reflective possibility', reading: 'The moon could invite reflection on receiving and reflecting insight.', reflectionQuestion: 'What does reflection evoke for you?', basis: 'reflection', tradition: '', sources: [], ...overrides });
const tradition = (overrides = {}) => reading({ basis: 'tradition', tradition: 'A named symbolic system', sources: [{ title: 'Provider title', url: citation }], ...overrides });
const withReadings = (...items) => ({ ...empty(), symbolicReadings: items });
const ok = (data) => ({ ok: true, status: 200, json: async () => data });
const responseOutput = (result) => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] });
const researchOutput = () => ({ status: 'completed', output: [
  { type: 'web_search_call', status: 'completed', action: { type: 'search' } },
  { type: 'message', content: [{ type: 'output_text', text: 'Context for the passage.', annotations: [{ type: 'url_citation', url: citation, title: 'Provider title' }] }] },
] });
const chatOutput = (result) => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] });
const geminiOutput = (result) => ({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(result) }] }] });

function adapterFixture(name, result) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, body });
    if (url === 'https://api.tavily.com/search') return ok({ results: [{ url: citation, title: 'Retrieved title', content: 'Symbolic context from a named tradition.' }] });
    if (name === 'openai') {
      if (body.tools) return ok(researchOutput());
      // Passage-only output cannot contribute external or symbolic interpretation.
      const researched = JSON.parse(body.input[1].content.startsWith('{') ? body.input[1].content : '{}').providerReportedUrls;
      return ok(responseOutput(researched ? result : { ...empty(), symbolicReadings: [reading({ title: 'Contaminated rhetorical output' })] }));
    }
    if (name === 'grok') return ok({ ...responseOutput(result), citations: [citation] });
    if (name === 'groq') {
      if (body.tools) return ok({ choices: [{ message: { content: 'Context.', executed_tools: [{ search_results: { results: [{ url: citation }] } }] } }] });
      return ok(chatOutput(result));
    }
    const requestedSchema = name === 'gemini' ? body.response_format.schema : body.response_format.json_schema.schema;
    const data = requestedSchema.properties.queries ? { queries: ['Moon symbolism context'] } : result;
    return ok(name === 'gemini' ? geminiOutput(data) : chatOutput(data));
  };
  return { calls, fetchImpl };
}

const adapterCases = [
  ['openai', analyzeWithOpenAI, 3], ['grok', analyzeWithGrok, 1], ['groq', analyzeWithGroq, 2],
  ['gemini', analyzeWithGemini, 3], ['cloudflare', analyzeWithCloudflare, 3],
];
const credentials = { apiKey: 'test-key', apiToken: 'test-token', accountId: 'a'.repeat(32), tavilyApiKey: 'test-search-key' };

test('the symbolic schema is composed only for opt-in and leaves the base contract intact', () => {
  assert.equal(symbolicSchema(schema), schema);
  const enabled = symbolicSchema(schema, true);
  assert.equal(schema.properties.symbolicReadings, undefined);
  assert.deepEqual(enabled.required, [...schema.required, 'symbolicReadings']);
  assert.equal(enabled.properties.symbolicReadings.maxItems, 3);
  assert.deepEqual(enabled.properties.symbolicReadings.items.required, ['excerpt', 'title', 'reading', 'reflectionQuestion', 'basis', 'tradition', 'sources']);
  assert.deepEqual(enabled.properties.symbolicReadings.items.properties.basis.enum, ['reflection', 'tradition']);
});

test('symbolic validation preserves exact multilingual excerpts and rejects fabricated provenance', () => {
  const raw = withReadings(
    reading({ excerpt: 'Never in the submitted passage' }),
    tradition({ sources: [{ title: 'Invented', url: 'https://example.org/invented' }] }),
    tradition({ sources: [{ title: 'Unsafe', url: 'javascript:alert(1)' }] }),
    tradition({ tradition: ' ' }), reading({ tradition: 'A named system without attribution' }),
    reading({ basis: 'supported' }), reading({ reflectionQuestion: null }),
    reading({ excerpt: 'הירח משקף אור.', title: 'אפשרות', reading: 'קריאה אפשרית.', reflectionQuestion: 'מה עולה בך?', sources: [{ title: 'Unnecessary claim of provenance', url: citation }] }),
    tradition({ excerpt: 'Луна отражает свет.', sources: [{ title: 'Primary', url: citation + '#passage' }, { title: 'Invented', url: 'https://invented.example/' }] }),
    reading(), reading({ title: 'Fourth valid entry' }),
  );
  const actual = validatedResult(raw, { citations: [citation, 'javascript:alert(1)'] }, original, 'he', { includeSymbolicReadings: true });
  assert.equal(actual.symbolicReadings.length, 3);
  assert.deepEqual(actual.symbolicReadings.map(({ excerpt }) => excerpt), ['הירח משקף אור.', 'Луна отражает свет.', 'The moon reflects light.']);
  assert.deepEqual(actual.symbolicReadings[0].sources, []);
  assert.deepEqual(actual.symbolicReadings[1].sources, [{ title: 'Primary', url: citation }]);
  assert.ok(actual.symbolicReadings.every((item) => !Object.hasOwn(item, 'status') && !Object.hasOwn(item, 'isReasoningFlaw')));
  assert.deepEqual(validatedResult(raw, { citations: [citation] }, original), empty(), 'Unrequested provider additions are never exposed.');
});

test('enabled symbolic output requires its array but permits no useful readings', () => {
  for (const symbolicReadings of [undefined, null, {}, '', 1]) {
    assert.throws(() => validatedResult({ ...empty(), symbolicReadings }, {}, original, 'ru', { includeSymbolicReadings: true }), (error) => error.status === 502);
  }
  assert.deepEqual(validatedResult(withReadings(), {}, original, 'en', { includeSymbolicReadings: true }), withReadings());
});

test('all adapters add readings within existing calls and token/search budgets, only when requested', async () => {
  for (const [name, adapter, count] of adapterCases) for (const enabled of [false, true]) {
    const fixture = adapterFixture(name, withReadings(reading(), tradition()));
    const actual = await adapter(original, { ...credentials, language: 'ru', includeSymbolicReadings: enabled, fetchImpl: fixture.fetchImpl });
    assert.equal(fixture.calls.length, count, name);
    assert.equal(Object.hasOwn(actual, 'symbolicReadings'), enabled, name);
    if (enabled) {
      assert.equal(actual.symbolicReadings.length, 2, name);
      assert.equal(actual.symbolicReadings[0].title, 'A reflective possibility');
      assert.equal(actual.symbolicReadings[1].sources[0].title, ['gemini', 'cloudflare'].includes(name) ? 'Retrieved title' : 'Provider title');
    }
    const calls = fixture.calls.filter(({ url }) => url !== 'https://api.tavily.com/search');
    const requests = calls.map(({ body }) => body.text?.format?.schema || body.response_format?.json_schema?.schema || body.response_format?.schema).filter(Boolean);
    assert.equal(requests.filter((item) => item.properties.symbolicReadings).length, enabled ? 1 : 0, name);
    const final = calls.find(({ body }) => (body.text?.format?.schema || body.response_format?.json_schema?.schema || body.response_format?.schema)?.properties.symbolicReadings);
    if (enabled) {
      const prompt = final.body.system_instruction || final.body.input?.[0]?.content || final.body.messages[0].content;
      assert.match(prompt, /in Russian/);
      assert.match(prompt, /at most three/);
      assert.match(prompt, /untrusted/);
    }
    if (name === 'openai') {
      assert.equal(calls[0].body.max_tool_calls, 3);
      assert.deepEqual(calls.map(({ body }) => body.max_output_tokens), [4096, 4096, 4096]);
      assert.doesNotMatch(calls[2].body.input[0].content, /symbolicReadings/);
      assert.equal(calls[2].body.input[1].content, original);
      assert.equal(calls[2].body.text.format.schema.properties.symbolicReadings, undefined);
    } else if (name === 'gemini') assert.deepEqual(calls.map(({ body }) => body.generation_config.max_output_tokens), [2048, 8192]);
    else if (name === 'cloudflare') assert.deepEqual(calls.map(({ body }) => body.max_completion_tokens), [2048, 8192]);
    else if (name === 'groq') assert.deepEqual(calls.map(({ body }) => body.max_completion_tokens), [2048, 4096]);
  }
});

test('every adapter rejects an enabled response missing the symbolic array without retries', async () => {
  for (const [name, adapter, count] of adapterCases) {
    const fixture = adapterFixture(name, empty());
    await assert.rejects(() => adapter(original, { ...credentials, includeSymbolicReadings: true, fetchImpl: fixture.fetchImpl }), (error) => error.status === 502);
    assert.equal(fixture.calls.length, count, name);
  }
});

test('public, admin, and local dispatch retain explicit symbolic settings without enabling another provider', async () => {
  for (const deployment of ['public', 'admin', 'local']) {
    assert.equal(analysisConfiguration({ deployment, environment: modelEnvironment }).symbolicReadings, true);
    const cases = deployment === 'local' ? [['xai', 'grok'], ['openai', 'openai'], ['groq', 'groq']]
      : [['luna', 'openai'], ['gemini-3.8-flash', 'gemini'], ['glm-4.7-flash', 'cloudflare'], ['grok-4.7', 'grok']];
    for (const [choice, expected] of cases) for (const includeSymbolicReadings of [false, true]) {
      const calls = [];
      const adapters = Object.fromEntries(['grok', 'groq', 'openai', 'gemini', 'cloudflare'].map((name) => [name, async (_text, options) => { calls.push({ name, options }); return empty(); }]));
      await analyzeConfigured(original, { includeSymbolicReadings, ...(deployment === 'local' ? {} : { modelId: choice }) }, { deployment, environment: { ...modelEnvironment, ANALYSIS_PROVIDER: choice }, ...adapters });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].name, expected);
      assert.equal(calls[0].options.includeSymbolicReadings, includeSymbolicReadings);
    }
  }
});

test('HTTP validates symbolic opt-in before quota/extraction and localizes errors on both domains', async () => {
  for (const deployment of ['public', 'admin', 'local']) {
    let acquisitions = 0, extractions = 0, releases = 0;
    const seen = [];
    const app = createApp({ deployment, modelEnvironment,
      sharedLimiter: { acquire: async () => { acquisitions++; return async () => { releases++; }; } },
      extract: async () => { extractions++; return original; },
      analyze: async (_text, options) => { seen.push(options); return options.includeSymbolicReadings ? withReadings(reading()) : empty(); },
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const send = async (settings) => {
        const response = await fetch(base + '/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '8.8.8.8' }, body: JSON.stringify({ type: 'url', content: 'https://example.org/passage', ...settings }) });
        return { status: response.status, body: await response.json() };
      };
      assert.equal((await (await fetch(base + '/api/config')).json()).symbolicReadings, true);
      for (const language of ['en', 'he', 'ru']) for (const includeSymbolicReadings of [null, 0, 'true', [], {}]) {
        const response = await send({ language, includeSymbolicReadings });
        assert.equal(response.status, 400);
        assert.deepEqual(response.body, { error: localize('Choose a valid symbolic reading setting.', language) });
      }
      assert.deepEqual([acquisitions, extractions, seen.length], [0, 0, 0]);
      for (const includeSymbolicReadings of [true, false, undefined]) {
        const response = await send({ includeSymbolicReadings });
        assert.equal(response.status, 200);
        assert.equal(Object.hasOwn(response.body, 'symbolicReadings'), includeSymbolicReadings === true);
        assert.equal(seen.at(-1).includeSymbolicReadings, includeSymbolicReadings);
      }
      assert.equal(extractions, 3);
      assert.equal(acquisitions, deployment === 'public' ? 3 : 0);
      assert.equal(releases, acquisitions);
    } finally { await new Promise((resolve) => server.close(resolve)); }
  }
});
