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

test('public deployment uses only GPT-OSS 120B and never calls xAI', async () => {
  await withEnvironment({ VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'public', SOPHIA_GROQ_FREE_CONFIRMED: 'true', XAI_API_KEY: 'not-for-public', ANALYSIS_PROVIDER: 'xai' }, async () => {
    const calls = [];
    const grok = async () => { throw new Error('xAI must never be called'); };
    const groq = async (_text, options) => { calls.push(options); return result(); };
    assert.equal(supportsReasoning(), false);
    assert.deepEqual(await analyzeConfigured('Claim', { language: 'he' }, { grok, groq }), result());
    assert.deepEqual(calls, [{ model: 'openai/gpt-oss-120b', language: 'he', requireCitations: true, maxRetryWaitSeconds: 30 }]);
    await assert.rejects(() => analyzeConfigured('Claim', { reasoningEffort: 'high' }, { grok, groq }), /Grok only/);
  });
});

test('public OpenAI use requires explicit cost opt-in and never falls back', async () => {
  await withEnvironment({ VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'public', SOPHIA_PUBLIC_PROVIDER: 'openai', SOPHIA_OPENAI_COSTS_CONFIRMED: undefined }, async () => {
    const calls = [];
    const openai = async (_text, options) => { calls.push(options); return result(); };
    const groq = async () => { throw new Error('Unexpected fallback'); };
    await assert.rejects(() => analyzeConfigured('Claim', {}, { openai, groq }), /costs are not configured/);
    assert.equal(calls.length, 0);
    process.env.SOPHIA_OPENAI_COSTS_CONFIRMED = 'true';
    assert.deepEqual(await analyzeConfigured('Claim', { language: 'ru' }, { openai, groq }), result());
    assert.deepEqual(calls, [{ language: 'ru', model: 'gpt-6-luna', requireCitations: true }]);
    await assert.rejects(() => analyzeConfigured('Claim', { reasoningEffort: 'high' }, { openai, groq }), /Grok only/);
    await assert.rejects(() => analyzeConfigured('Claim', {}, { openai: async () => { throw new AppError(503, 'OpenAI unavailable'); }, groq }), /OpenAI unavailable/);
  });
});

test('unknown public provider fails closed, and local OpenAI forwards language', async () => {
  await withEnvironment({ VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'public', SOPHIA_PUBLIC_PROVIDER: 'unknown' }, async () => {
    await assert.rejects(() => analyzeConfigured('Claim'), /public provider is not configured/);
  });
  await withEnvironment({ VERCEL: undefined, ANALYSIS_PROVIDER: 'openai' }, async () => {
    assert.equal(supportsReasoning(), false);
    const openai = async (_text, options) => { assert.deepEqual(options, { language: 'he' }); return result(); };
    assert.deepEqual(await analyzeConfigured('Claim', { language: 'he' }, { openai }), result());
  });
});

test('deployed Groq fails closed without confirmed free access and does not fall back to a smaller model', async () => {
  await withEnvironment({ VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'public', SOPHIA_GROQ_FREE_CONFIRMED: undefined }, async () => {
    let called = false;
    await assert.rejects(() => analyzeConfigured('Claim', {}, { groq: async () => { called = true; return result(); } }), /not configured/);
    assert.equal(called, false);
    process.env.SOPHIA_GROQ_FREE_CONFIRMED = 'true';
    for (const error of [new AppError(429, 'Rate limited'), Object.assign(new AppError(503, 'No research'), { providerResearchUnavailable: true }), new AppError(503, 'Invalid credentials')]) {
      const calls = [];
      await assert.rejects(() => analyzeConfigured('Claim', {}, { groq: async (_text, options) => { calls.push(options); throw error; } }), (actual) => actual === error);
      assert.deepEqual(calls.map(({ model }) => model), ['openai/gpt-oss-120b']);
    }
  });
});

test('a Groq browser tool failure returns an unavailable error without provider details or another model', async () => {
  await withEnvironment({ VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'public', SOPHIA_GROQ_FREE_CONFIRMED: 'true' }, async () => {
    const calls = [];
    const fetchImpl = async (_url, options) => {
      calls.push(JSON.parse(options.body));
      return { ok: false, status: 400, json: async () => ({ error: { code: 'tool_use_failed', failed_generation: 'private provider detail' } }) };
    };
    const groq = (text, options) => analyzeWithGroq(text, { ...options, apiKey: 'test', fetchImpl });
    await assert.rejects(() => analyzeConfigured('Claim', {}, { groq }), (error) => {
      assert.equal(error.providerResearchUnavailable, true);
      assert.equal(error.status, 503);
      assert.doesNotMatch(error.message, /private provider detail/);
      return true;
    });
    assert.deepEqual(calls.map((body) => body.model), ['openai/gpt-oss-120b']);
  });
});

test('other Groq 400 errors and credentials do not trigger a model fallback', async () => {
  await withEnvironment({ VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'public', SOPHIA_GROQ_FREE_CONFIRMED: 'true' }, async () => {
    for (const scenario of ['research-400', 'analysis-tool-error', 'invalid-credentials', 'malformed-error']) {
      const calls = [];
      const fetchImpl = async (_url, options) => {
        calls.push(JSON.parse(options.body));
        if (scenario === 'analysis-tool-error' && calls.length === 1) {
          return { ok: true, json: async () => ({ choices: [{ message: {
            content: 'Research', executed_tools: [{ browser_results: [{ url: 'https://example.org/source' }] }],
          } }] }) };
        }
        return { ok: false, status: scenario === 'invalid-credentials' ? 401 : 400, json: async () => {
          if (scenario === 'malformed-error') throw new Error('private provider detail');
          return { error: { code: scenario === 'analysis-tool-error' ? 'tool_use_failed' : 'bad_request', failed_generation: 'private provider detail' } };
        } };
      };
      const groq = (text, options) => analyzeWithGroq(text, { ...options, apiKey: 'test', fetchImpl });
      await assert.rejects(() => analyzeConfigured('Claim', {}, { groq }), (error) => {
        assert.equal(error.status, scenario === 'invalid-credentials' ? 503 : 502);
        assert.notEqual(error.providerResearchUnavailable, true);
        assert.doesNotMatch(error.message, /private provider detail/);
        return true;
      });
      assert.equal(calls.length, scenario === 'analysis-tool-error' ? 2 : 1, scenario);
      assert.ok(calls.every((body) => body.model === 'openai/gpt-oss-120b'), scenario);
    }
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
    assert.deepEqual(calls, [{ model: 'grok-4.7', reasoningEffort: 'high' }, { model: 'openai/gpt-oss-120b', requireCitations: true, maxRetryWaitSeconds: 30 }]);
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
