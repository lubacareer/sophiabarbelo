import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { analyzeConfigured, analysisConfiguration } from './provider.js';
import { modelEnvironment } from '../test-support/models.js';

const emptyResult = { claims: [], rhetoric: [], limitations: [] };

test('public Luna is forbidden before quota, extraction, and analysis despite credentials and forged administrator identity', async () => {
  const calls = { quota: 0, extract: 0, analyze: 0 };
  const app = createApp({
    deployment: 'public',
    modelEnvironment: { ...modelEnvironment, SOPHIA_DEPLOYMENT_ROLE: 'admin', SOPHIA_ADMIN_PROTECTION_CONFIRMED: 'true' },
    sharedLimiter: { acquire: async () => { calls.quota++; return async () => {}; } },
    extract: async () => { calls.extract++; return 'An article.'; },
    analyze: async () => { calls.analyze++; return emptyResult; },
  });
  const expected = {
    en: 'Luna is available on the administrator site only.',
    he: 'Luna זמין באתר המנהל בלבד.',
    ru: 'Luna доступна только на сайте администратора.',
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    for (const language of ['en', 'he', 'ru']) for (const type of ['text', 'url']) for (const includeSymbolicReadings of [false, true]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/analyze`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.1', 'x-sophia-admin': '1', authorization: 'Bearer forged-secret' },
        body: JSON.stringify({ type, content: type === 'url' ? 'https://example.org/article' : 'A public passage.', language, modelId: 'luna', includeSymbolicReadings, deployment: 'admin', role: 'admin' }),
      });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: expected[language] });
    }
    assert.deepEqual(calls, { quota: 0, extract: 0, analyze: 0 });
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('public Luna policy cannot be enabled by credentials, flags, or client provider options', async () => {
  for (const environment of [modelEnvironment, {}, { ...modelEnvironment, SOPHIA_DEPLOYMENT_ROLE: 'admin', SOPHIA_PUBLIC_PROVIDER: 'openai', ANALYSIS_PROVIDER: 'openai' }]) {
    const config = analysisConfiguration({ deployment: 'public', environment });
    assert.deepEqual(config.models.find(({ id }) => id === 'luna'), {
      id: 'luna', label: 'GPT-6 Luna', available: false, unavailableReason: 'admin_only', reasoningControls: false, access: 'credits',
    });
    const adapters = Object.fromEntries(['openai', 'gemini', 'cloudflare', 'grok', 'groq'].map((name) => [name, async () => assert.fail('A forbidden model must not invoke any adapter')]));
    await assert.rejects(() => analyzeConfigured('A passage.', { modelId: 'luna', provider: 'openai', deployment: 'admin', costsConfirmed: true }, { deployment: 'public', environment, ...adapters }), (error) => error.status === 403);
  }
});
