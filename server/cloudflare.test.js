import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithCloudflare } from './cloudflare.js';

const options = { accountId: 'a'.repeat(32), apiToken: 'private-cloudflare-token', tavilyApiKey: 'private-tavily-key' };
const empty = { claims: [], rhetoric: [], limitations: [] };
const completion = (value) => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }) });

test('Cloudflare pins GLM and its account-scoped Chat Completions endpoint with structured outputs', async () => {
  const calls = [];
  const original = 'Автор пишет: «Не всякое страдание доказывает вину». ';
  const result = await analyzeWithCloudflare(original, { ...options, language: 'ru', model: 'another-model', fetchImpl: async (url, request) => {
    const body = JSON.parse(request.body);
    calls.push({ url, body, request });
    if (url === 'https://api.tavily.com/search') return { ok: true, json: async () => ({ results: [{ url: 'https://example.org/context', title: 'Context', content: 'Evidence does not establish the inference.' }] }) };
    return completion(calls.length === 1 ? { queries: ['Evidence suffering guilt inference'] } : empty);
  } });
  assert.deepEqual(result, empty);
  assert.equal(calls.length, 3);
  for (const call of [calls[0], calls[2]]) {
    assert.equal(call.url, `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/ai/v1/chat/completions`);
    assert.equal(call.request.headers.authorization, `Bearer ${options.apiToken}`);
    assert.equal(call.body.model, '@cf/zai-org/glm-4.7-flash');
    assert.equal(call.body.store, false);
    assert.equal(call.body.stream, false);
    assert.equal(call.body.response_format.type, 'json_schema');
    assert.equal(call.body.response_format.json_schema.strict, true);
    assert.equal(Object.hasOwn(call.body, 'tools'), false);
    assert.ok(call.request.signal instanceof AbortSignal);
  }
  assert.equal(calls[0].body.max_completion_tokens, 2048);
  assert.deepEqual(calls[0].body.chat_template_kwargs, { enable_thinking: false });
  assert.equal(calls[2].body.max_completion_tokens, 8192);
  assert.equal(Object.hasOwn(calls[2].body, 'chat_template_kwargs'), false, 'Only query generation should disable thinking; final analysis keeps its existing behavior.');
  assert.equal(calls[0].body.messages[1].content, original);
  assert.match(calls[2].body.messages[0].content, /in Russian/);
  assert.equal(JSON.parse(calls[2].body.messages[1].content).originalText, original);
});

test('Cloudflare rejects truncation, refusal, tool calls, malformed JSON, and incomplete completions', async () => {
  for (const choice of [
    undefined,
    { finish_reason: 'length', message: { content: '{"queries":["valid-looking"]}' } },
    { finish_reason: 'content_filter', message: { content: '{}' } },
    { finish_reason: 'stop', message: { content: '{}', refusal: 'private provider details' } },
    { finish_reason: 'stop', message: { content: '{}', tool_calls: [{ id: 'unexpected' }] } },
    { finish_reason: 'stop', message: { content: '{' } },
    { message: { content: '{}' } },
  ]) {
    let calls = 0;
    await assert.rejects(() => analyzeWithCloudflare('Claim', { ...options, fetchImpl: async () => {
      calls++;
      return { ok: true, json: async () => ({ choices: choice ? [choice] : [] }) };
    } }), (error) => error.status === 502 && !error.message.includes('private'));
    assert.equal(calls, 1);
  }
});

test('Cloudflare rejects missing credentials or unsafe account identifiers before requests', async () => {
  for (const overrides of [{ accountId: '' }, { accountId: '../../other-account' }, { accountId: 'https://private.example' }, { apiToken: '' }, { tavilyApiKey: '' }]) {
    await assert.rejects(() => analyzeWithCloudflare('Claim', { ...options, ...overrides, fetchImpl: async () => { assert.fail('No provider request is allowed'); } }), (error) => error.status === 503);
  }
});
