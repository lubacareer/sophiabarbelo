import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithGemini } from './gemini.js';
import { createDeadline } from './deadline.js';

const empty = { claims: [], rhetoric: [], limitations: [] };
const interaction = (value) => ({ ok: true, json: async () => ({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(value) }] }] }) });
const options = { apiKey: 'private-gemini-test-key', tavilyApiKey: 'private-tavily-test-key' };

test('Gemini uses stateless low-thinking Interactions with fixed model and Tavily research, without Google tools', async () => {
  const calls = [];
  const original = 'הדובר אמר: "ייתכן שהטענה שגויה."';
  const result = await analyzeWithGemini(original, { ...options, language: 'he', model: 'untrusted-model', fetchImpl: async (url, request) => {
    const body = JSON.parse(request.body);
    calls.push({ url, body, request });
    if (url === 'https://api.tavily.com/search') return { ok: true, json: async () => ({ results: [{ url: 'https://example.org/evidence#part', title: 'Actual source title', content: 'Context, not proof that the claim is false.' }] }) };
    return interaction(calls.length === 1 ? { queries: ['Evidence for and against the passage claim'] } : empty);
  } });
  assert.deepEqual(result, empty);
  assert.equal(calls.length, 3);
  const modelCalls = [calls[0], calls[2]];
  for (const call of modelCalls) {
    assert.equal(call.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(call.request.headers['x-goog-api-key'], options.apiKey);
    assert.equal(call.body.model, 'gemini-3.8-flash');
    assert.equal(call.body.store, false);
    assert.equal(call.body.stream, false);
    assert.equal(call.body.generation_config.thinking_level, 'low');
    assert.equal(call.body.generation_config.thinking_summaries, 'none');
    assert.equal(call.body.response_format.type, 'text');
    assert.equal(call.body.response_format.mime_type, 'application/json');
    assert.equal(Object.hasOwn(call.body, 'tools'), false);
    assert.equal(Object.hasOwn(call.body, 'previous_interaction_id'), false);
    assert.doesNotMatch(call.url, /private|key=/);
    assert.ok(call.request.signal instanceof AbortSignal);
  }
  assert.equal(modelCalls[0].body.generation_config.max_output_tokens, 2048);
  assert.equal(modelCalls[1].body.generation_config.max_output_tokens, 8192);
  assert.equal(modelCalls[0].body.input, original);
  assert.match(modelCalls[0].body.system_instruction, /quotation fidelity only when the input explicitly asserts or requests it/);
  assert.match(modelCalls[1].body.system_instruction, /in Hebrew/);
  const finalInput = JSON.parse(modelCalls[1].body.input);
  assert.equal(finalInput.originalText, original);
  assert.deepEqual(finalInput.providerReportedUrls, ['https://example.org/evidence']);
});

test('Gemini rejects incomplete, refused, truncated, or malformed interactions without searching', async () => {
  for (const data of [
    null, {}, { status: 'requires_continuation', steps: [] }, { status: 'failed', steps: [] },
    { status: 'completed', outputs: [{ type: 'text', text: '{}' }] },
    { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'refusal', text: 'private refusal detail' }] }] },
    { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"queries":[' }] }] },
  ]) {
    let calls = 0;
    await assert.rejects(() => analyzeWithGemini('Original claim', { ...options, fetchImpl: async () => {
      calls++;
      return { ok: true, json: async () => data };
    } }), (error) => error.status === 502 && !error.message.includes('private'));
    assert.equal(calls, 1);
  }
});

test('Gemini requires both credentials before starting any provider request', async () => {
  for (const overrides of [{ apiKey: '' }, { tavilyApiKey: '' }]) {
    await assert.rejects(() => analyzeWithGemini('Original', { ...options, ...overrides, fetchImpl: async () => { assert.fail('No provider request is allowed'); } }), (error) => error.status === 503);
  }
});

test('Gemini honors the request deadline before search rather than starting a fresh research budget', async () => {
  let clock = 0;
  const deadline = createDeadline(280_000, { now: () => clock, setTimer: () => null, clearTimer: () => {} });
  clock = 250_000;
  let calls = 0;
  let requestSignal;
  try {
    await assert.rejects(() => analyzeWithGemini('Claim', { ...options, deadline, fetchImpl: async (_url, request) => {
      calls++;
      requestSignal = request.signal;
      return { ok: true, json: async () => { clock = 280_001; return { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"queries":["Context"]}' }] }] }; } };
    } }), (error) => error.status === 504);
    assert.equal(calls, 1, 'No Tavily or final model call may follow expiry.');
    assert.equal(requestSignal.aborted, true);
  } finally { deadline.dispose(); }
});
