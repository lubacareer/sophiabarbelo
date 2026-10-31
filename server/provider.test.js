import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from './errors.js';
import { analyzeConfigured, supportsReasoning } from './provider.js';
import { analyzeWithGroq } from './groq.js';
import { analyzeWithGrok } from './grok.js';

async function withEnvironment(values, run) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try { return await run(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function result() { return { claims: [], rhetoric: [], limitations: [] }; }

test('reasoning controls match the effective local Grok 4.7 model', async () => {
  await withEnvironment({ VERCEL: undefined, ANALYSIS_PROVIDER: undefined, XAI_MODEL: undefined }, async () => {
    assert.equal(supportsReasoning(), true);
    process.env.ANALYSIS_PROVIDER = 'xai';
    process.env.XAI_MODEL = 'grok-4.7';
    assert.equal(supportsReasoning(), true);
    for (const model of ['grok-4.3', 'grok-4.20-multi-agent', 'grok-4.7-other', 'other-model']) {
      process.env.XAI_MODEL = model;
      assert.equal(supportsReasoning(), false, model);
    }
    process.env.XAI_MODEL = 'grok-4.7';
    process.env.ANALYSIS_PROVIDER = 'groq';
    assert.equal(supportsReasoning(), false);
  });
});

test('deployment reasoning controls follow the model fixed by the deployment role', async () => {
  await withEnvironment({ VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'public', ANALYSIS_PROVIDER: 'xai', XAI_MODEL: 'grok-4.7' }, async () => {
    assert.equal(supportsReasoning(), false);
    process.env.SOPHIA_DEPLOYMENT_ROLE = 'admin';
    process.env.XAI_MODEL = 'grok-4.20-multi-agent';
    assert.equal(supportsReasoning(), true);
  });
});

test('public deployment never uses xAI and falls back to a second free research model on rate limits', async () => {
  await withEnvironment({ VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'public', SOPHIA_GROQ_FREE_CONFIRMED: 'true', XAI_API_KEY: 'not-for-public', ANALYSIS_PROVIDER: 'xai' }, async () => {
    const calls = [];
    const grok = async () => { throw new Error('xAI must never be called'); };
    const groq = async (_text, options) => {
      calls.push(options);
      if (calls.length === 1) throw new AppError(429, 'Rate limited');
      return result();
    };
    assert.equal(supportsReasoning(), false);
    const output = await analyzeConfigured('Claim', {}, { grok, groq });
    assert.deepEqual(calls.map((item) => item.model), ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']);
    assert.ok(calls.every((item) => item.requireCitations && item.maxRetryWaitSeconds === 0));
    assert.match(output.limitations[0], /fallback model/);
    await assert.rejects(() => analyzeConfigured('Claim', { reasoningEffort: 'high' }, { grok, groq }), /Grok only/);
  });
});

test('deployed Groq research fails closed without confirmed free access and retries unavailable research only', async () => {
  await withEnvironment({ VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'public', SOPHIA_GROQ_FREE_CONFIRMED: undefined }, async () => {
    let called = false;
    await assert.rejects(() => analyzeConfigured('Claim', {}, { groq: async () => { called = true; return result(); } }), /not configured/);
    assert.equal(called, false);
    process.env.SOPHIA_GROQ_FREE_CONFIRMED = 'true';
    let attempts = 0;
    const unavailable = new AppError(503, 'No research');
    unavailable.providerResearchUnavailable = true;
    const output = await analyzeConfigured('Claim', {}, { groq: async () => { if (++attempts === 1) throw unavailable; return result(); } });
    assert.equal(attempts, 2);
    assert.match(output.limitations[0], /fallback/);
    attempts = 0;
    await assert.rejects(() => analyzeConfigured('Claim', {}, { groq: async () => { attempts++; throw new AppError(503, 'Invalid credentials'); } }), /Invalid credentials/);
    assert.equal(attempts, 1);
  });
});

test('admin uses Grok 4.7 and only falls back to confirmed free research on provider rate limits', async () => {
  await withEnvironment({ VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'admin', SOPHIA_GROQ_FREE_CONFIRMED: 'true' }, async () => {
    const calls = [];
    const error = new AppError(503, 'Rate limited');
    error.providerRateLimited = true;
    const grok = async (_text, options) => { calls.push(options); throw error; };
    const groq = async (_text, options) => { calls.push(options); return result(); };
    assert.equal(supportsReasoning(), true);
    const output = await analyzeConfigured('Claim', { reasoningEffort: 'high' }, { grok, groq });
    assert.deepEqual(calls, [{ model: 'grok-4.7', reasoningEffort: 'high' }, { model: 'openai/gpt-oss-20b', requireCitations: true, maxRetryWaitSeconds: 0 }]);
    assert.match(output.limitations[0], /Grok reached its usage limit/);
    await assert.rejects(() => analyzeConfigured('Claim', {}, { grok: async () => { throw new AppError(503, 'Invalid credentials'); }, groq: async () => { throw new Error('Unexpected fallback'); } }), /Invalid credentials/);
  });
});

test('xAI distinguishes provider rate limits from credential failures', async () => {
  await assert.rejects(() => analyzeWithGrok('Claim', { apiKey: 'test', fetchImpl: async () => ({ ok: false, status: 429 }) }),
    (error) => error.providerRateLimited === true);
  await assert.rejects(() => analyzeWithGrok('Claim', { apiKey: 'test', fetchImpl: async () => ({ ok: false, status: 401 }) }),
    (error) => error.providerRateLimited !== true);
});

test('Vercel with no valid deployment role fails closed', async () => {
  await withEnvironment({ VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: undefined }, async () => {
    assert.throws(() => supportsReasoning(), /deployment role/);
    await assert.rejects(() => analyzeConfigured('Claim'), /deployment role/);
  });
});

test('free research requires provider-reported, valid web citations', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'Research', executed_tools: [{ browser_results: [{ url: 'http://user:pass@example.org/' }, { url: 'file:///private' }] }] } }] }) };
  };
  await assert.rejects(() => analyzeWithGroq('Claim', { apiKey: 'test', fetchImpl, requireCitations: true }), /Web research is temporarily unavailable/);
  assert.equal(calls, 1);
});
