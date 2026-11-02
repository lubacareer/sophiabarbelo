import test from 'node:test';
import assert from 'node:assert/strict';
import { searchWithTavily } from './tavily.js';

test('Tavily fixes search cost parameters and uses only five safe metadata results', async () => {
  const results = Array.from({ length: 6 }, (_, index) => ({ url: `https://example.org/source-${index}#section`, title: `Source ${index}`, content: 'Evidence '.repeat(1000) }));
  const sources = await searchWithTavily('A focused query', { apiKey: 'private-test-key', fetchImpl: async (url, request) => {
    assert.equal(url, 'https://api.tavily.com/search');
    assert.equal(request.redirect, 'error');
    assert.equal(request.headers.authorization, 'Bearer private-test-key');
    assert.deepEqual(JSON.parse(request.body), { query: 'A focused query', search_depth: 'advanced', max_results: 5, topic: 'general', auto_parameters: false, include_answer: false, include_raw_content: false, include_images: false, include_usage: true });
    return { ok: true, json: async () => ({ results, answer: 'Invented answer https://evil.example/invented', citations: ['https://evil.example/invented'] }) };
  } });
  assert.equal(sources.length, 5);
  assert.equal(sources[0].url, 'https://example.org/source-0');
  assert.ok(sources.every((source) => source.content.length === 5000));
});

test('Tavily excludes unsafe URL metadata, invalid results, and missing source content', async () => {
  for (const url of ['javascript:alert(1)', 'file:///private', 'https://user:private@example.org', 'https://127.0.0.1', 'http://[::1]', 'https://localhost', 'https://internal.local', 'https://example.org:8443', 'https://example.org/\nprivate', 'x'.repeat(2049), null]) {
    const sources = await searchWithTavily('Query', { apiKey: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ results: [{ url, title: 'Unsafe', content: 'Text' }] }) }) });
    assert.deepEqual(sources, []);
  }
  const sources = await searchWithTavily('Query', { apiKey: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ results: [null, { url: 'https://example.org' }, { url: 'https://example.org/blank', content: '   ' }] }) }) });
  assert.deepEqual(sources, []);
});

test('Tavily rejects malformed responses and invalid queries without leaking details or retrying', async () => {
  for (const query of ['', ' ', 'x'.repeat(401), null]) {
    await assert.rejects(() => searchWithTavily(query, { apiKey: 'test', fetchImpl: async () => { assert.fail('Invalid query must not call Tavily'); } }), (error) => error.status === 502);
  }
  for (const payload of [null, {}, { results: 'private provider detail' }]) {
    let calls = 0;
    await assert.rejects(() => searchWithTavily('Query', { apiKey: 'test', fetchImpl: async () => { calls++; return { ok: true, json: async () => payload }; } }), (error) => error.status === 503 && !error.message.includes('private'));
    assert.equal(calls, 1);
  }
});
