import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from './errors.js';
import { analyzeConfigured, analysisConfiguration, resolveAnalysisModel, supportsReasoning } from './provider.js';
import { analyzeWithGroq } from './groq.js';
import { analyzeWithGrok } from './grok.js';
import { modelEnvironment } from '../test-support/models.js';
import { createDeadline } from './deadline.js';

const result = () => ({ claims: [], rhetoric: [], limitations: [] });
const ids = ['luna', 'gemini-3.8-flash', 'glm-4.7-flash', 'grok-4.7'];

function context(deployment, environment = modelEnvironment) {
  return { deployment, environment };
}

test('both deployed catalogs contain the same four fixed models with Luna default and safe availability metadata', () => {
  for (const deployment of ['public', 'admin']) {
    const config = analysisConfiguration(context(deployment));
    assert.equal(config.defaultModelId, 'luna');
    assert.equal(config.reasoningControls, false);
    assert.deepEqual(config.models.map((model) => model.id), ids);
    assert.deepEqual(config.models.map((model) => model.label), ['GPT-6 Luna', 'Gemini 3.8 Flash', 'GLM-4.7-Flash', 'Grok 4.7']);
    assert.deepEqual(config.models.map((model) => model.access), ['credits', 'free', 'free', 'credits']);
    assert.ok(config.models.every((model) => model.available && model.unavailableReason === null));
    assert.deepEqual(config.models.filter((model) => model.reasoningControls).map((model) => model.id), deployment === 'admin' ? ['grok-4.7'] : []);
    assert.doesNotMatch(JSON.stringify(config), /test-.*-(?:key|token)|apiKey|API_KEY|account|@cf|gpt-oss/i);
    for (const model of config.models) assert.deepEqual(Object.keys(model).sort(), ['access', 'available', 'id', 'label', 'reasoningControls', 'unavailableReason'].sort());
  }
});

test('availability requires every provider credential and free/cost confirmation, without hiding catalog options', () => {
  const requirements = {
    luna: ['OPENAI_API_KEY', 'SOPHIA_OPENAI_COSTS_CONFIRMED'],
    'gemini-3.8-flash': ['GEMINI_API_KEY', 'SOPHIA_GEMINI_FREE_CONFIRMED', 'TAVILY_API_KEY', 'SOPHIA_TAVILY_FREE_CONFIRMED'],
    'glm-4.7-flash': ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'SOPHIA_CLOUDFLARE_FREE_CONFIRMED', 'TAVILY_API_KEY', 'SOPHIA_TAVILY_FREE_CONFIRMED'],
    'grok-4.7': ['XAI_API_KEY', 'SOPHIA_PUBLIC_XAI_COSTS_CONFIRMED'],
  };
  for (const [modelId, names] of Object.entries(requirements)) for (const name of names) {
    for (const value of ['', ' ', undefined, name.startsWith('SOPHIA_') ? 'TRUE' : '']) {
      const environment = { ...modelEnvironment, [name]: value };
      const config = analysisConfiguration(context('public', environment));
      assert.deepEqual(config.models.map((model) => model.id), ids);
      assert.deepEqual(config.models.find((model) => model.id === modelId), {
        ...analysisConfiguration(context('public')).models.find((model) => model.id === modelId),
        available: false, unavailableReason: 'not_configured',
        ...(modelId === 'gemini-3.8-flash' && name === 'SOPHIA_GEMINI_FREE_CONFIRMED' ? { access: 'credits' } : {}),
      });
      assert.throws(() => resolveAnalysisModel({ modelId }, context('public', environment)), (error) => error.status === 503);
    }
  }
  const admin = analysisConfiguration(context('admin', { ...modelEnvironment, SOPHIA_PUBLIC_XAI_COSTS_CONFIRMED: undefined }));
  assert.equal(admin.models.find((model) => model.id === 'grok-4.7').available, true);
  assert.equal(analysisConfiguration(context('public', { ...modelEnvironment, CLOUDFLARE_ACCOUNT_ID: 'invalid-account' })).models.find((model) => model.id === 'glm-4.7-flash').available, false);
  assert.equal(analysisConfiguration(context('admin', { ...modelEnvironment, SOPHIA_OPENAI_COSTS_CONFIRMED: undefined })).models.find((model) => model.id === 'luna').available, false);
  for (const deployment of ['public', 'admin']) assert.ok(analysisConfiguration(context(deployment, {})).models.every((model) => !model.available));
});

test('Gemini supports explicit API-credit activation in both roles without a free-tier attestation', async () => {
  for (const deployment of ['public', 'admin']) for (const free of [undefined, 'false', 'true']) {
    const environment = { ...modelEnvironment, SOPHIA_GEMINI_FREE_CONFIRMED: free, SOPHIA_GEMINI_COSTS_CONFIRMED: 'true' };
    const config = analysisConfiguration(context(deployment, environment));
    const gemini = config.models.find((model) => model.id === 'gemini-3.8-flash');
    assert.equal(gemini.available, true);
    assert.equal(gemini.unavailableReason, null);
    assert.equal(gemini.access, 'credits');
    assert.equal(resolveAnalysisModel({ modelId: gemini.id }, context(deployment, environment)).access, 'credits');
    assert.deepEqual(Object.keys(gemini).sort(), ['access', 'available', 'id', 'label', 'reasoningControls', 'unavailableReason'].sort());
    let calls = 0;
    const output = await analyzeConfigured('A claim', { modelId: gemini.id, language: 'he' }, {
      ...context(deployment, environment), gemini: async (_text, options) => {
        calls++;
        assert.deepEqual(options, { language: 'he', model: 'gemini-3.8-flash', requireCitations: true });
        return result();
      },
    });
    assert.equal(calls, 1);
    assert.equal(output.analysisModelId, gemini.id);
  }
});

test('paid Gemini activation retains its key and free Tavily requirements in both roles', async () => {
  for (const deployment of ['public', 'admin']) for (const name of ['GEMINI_API_KEY', 'TAVILY_API_KEY', 'SOPHIA_TAVILY_FREE_CONFIRMED']) {
    for (const value of [undefined, '', ' ', ...(name.startsWith('SOPHIA_') ? ['false', 'TRUE', ' true ', true, 1] : [])]) {
      const environment = { ...modelEnvironment, SOPHIA_GEMINI_FREE_CONFIRMED: 'false', SOPHIA_GEMINI_COSTS_CONFIRMED: 'true', [name]: value };
      const gemini = analysisConfiguration(context(deployment, environment)).models.find((model) => model.id === 'gemini-3.8-flash');
      assert.equal(gemini.access, 'credits');
      assert.equal(gemini.available, false);
      assert.equal(gemini.unavailableReason, 'not_configured');
      await assert.rejects(() => analyzeConfigured('Claim', { modelId: gemini.id }, { ...context(deployment, environment), gemini: async () => assert.fail('Missing prerequisites must not call Gemini') }), (error) => error.status === 503);
    }
  }
});

test('unconfirmed Gemini stays unavailable and client options cannot acknowledge server costs', async () => {
  for (const deployment of ['public', 'admin']) for (const confirmation of [undefined, 'false', '', ' ', 'TRUE', ' true ', true, 1]) {
    const environment = { ...modelEnvironment, SOPHIA_GEMINI_FREE_CONFIRMED: confirmation, SOPHIA_GEMINI_COSTS_CONFIRMED: confirmation };
    const gemini = analysisConfiguration(context(deployment, environment)).models.find((model) => model.id === 'gemini-3.8-flash');
    assert.equal(gemini.access, 'credits');
    assert.equal(gemini.available, false);
    assert.equal(gemini.unavailableReason, 'not_configured');
    await assert.rejects(() => analyzeConfigured('Claim', {
      modelId: gemini.id, access: 'credits', costsConfirmed: true, SOPHIA_GEMINI_COSTS_CONFIRMED: 'true',
      environment: { ...environment, SOPHIA_GEMINI_COSTS_CONFIRMED: 'true' },
    }, { ...context(deployment, environment), gemini: async () => assert.fail('Client-supplied confirmations must not activate Gemini') }), (error) => error.status === 503);
  }
});

test('deployed model dispatch pins each adapter/model and preserves language and result identity', async () => {
  const expected = [
    ['luna', 'openai', 'gpt-6-luna'],
    ['gemini-3.8-flash', 'gemini', 'gemini-3.8-flash'],
    ['glm-4.7-flash', 'cloudflare', '@cf/zai-org/glm-4.7-flash'],
    ['grok-4.7', 'grok', 'grok-4.7'],
  ];
  for (const deployment of ['public', 'admin']) for (const [modelId, provider, model] of expected) {
    const calls = [];
    const adapters = Object.fromEntries(['openai', 'gemini', 'cloudflare', 'grok', 'groq'].map((name) => [name, async (text, options) => {
      calls.push({ name, text, options });
      return { ...result(), analysisModelId: 'untrusted-provider-value' };
    }]));
    const output = await analyzeConfigured('A claim', { modelId, language: 'he', model: 'untrusted-model', provider: 'groq' }, { ...context(deployment), ...adapters });
    assert.deepEqual(calls, [{
      name: provider, text: 'A claim',
      options: { language: 'he', model, ...(provider === 'grok' ? deployment === 'public' ? { reasoningEffort: 'low' } : {} : { requireCitations: true }) },
    }]);
    assert.equal(output.analysisModelId, modelId);
  }
});

test('omitted deployed selection always uses Luna and ignores legacy provider/model environment switches', async () => {
  for (const deployment of ['public', 'admin']) {
    const environment = { ...modelEnvironment, VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: deployment === 'public' ? 'admin' : 'public', SOPHIA_PUBLIC_PROVIDER: 'groq', ANALYSIS_PROVIDER: 'groq', OPENAI_MODEL: 'other-openai-model' };
    let calls = 0;
    const output = await analyzeConfigured('Claim', {}, {
      ...context(deployment, environment),
      openai: async (_text, options) => { calls++; assert.equal(options.model, 'gpt-6-luna'); return result(); },
      grok: async () => { throw new Error('Unexpected Grok default'); },
      groq: async () => { throw new Error('Unexpected Groq default'); },
    });
    assert.equal(output.analysisModelId, 'luna');
    assert.equal(calls, 1);
  }
});

test('invalid model IDs and incompatible reasoning settings are rejected before invoking any adapter', async () => {
  const adapters = Object.fromEntries(['openai', 'gemini', 'cloudflare', 'grok', 'groq'].map((name) => [name, async () => { throw new Error('An adapter must not run'); }]));
  for (const deployment of ['public', 'admin']) {
    for (const modelId of ['', null, 1, [], {}, 'groq', 'openai/gpt-oss-120b', 'gpt-6-luna', '@cf/openai/gpt-oss-120b']) {
      await assert.rejects(() => analyzeConfigured('Claim', { modelId }, { ...context(deployment), ...adapters }), (error) => error.status === 400);
    }
    for (const modelId of ids) for (const reasoningEffort of ['low', 'medium', 'high']) {
      if (deployment === 'admin' && modelId === 'grok-4.7') continue;
      await assert.rejects(() => analyzeConfigured('Claim', { modelId, reasoningEffort }, { ...context(deployment), ...adapters }), (error) => error.status === 400 && /administrator Grok/.test(error.message));
    }
  }
  for (const reasoningEffort of ['', null, 1, 'xhigh', ['low']]) {
    assert.throws(() => resolveAnalysisModel({ modelId: 'grok-4.7', reasoningEffort }, context('admin')), (error) => error.status === 400);
  }
});

test('administrator Grok retains its selector while public Grok forces low independently of environment defaults', async () => {
  const calls = [];
  const grok = async (_text, options) => { calls.push(options); return result(); };
  for (const reasoningEffort of [undefined, 'low', 'medium', 'high']) {
    await analyzeConfigured('Claim', { modelId: 'grok-4.7', ...(reasoningEffort ? { reasoningEffort } : {}) }, { ...context('admin'), grok });
  }
  assert.deepEqual(calls.map((options) => options.reasoningEffort), [undefined, 'low', 'medium', 'high']);
  await analyzeConfigured('Claim', { modelId: 'grok-4.7' }, { ...context('public', { ...modelEnvironment, XAI_REASONING_EFFORT: 'xhigh' }), grok });
  assert.equal(calls.at(-1).reasoningEffort, 'low');
});

test('deployed failures never trigger another model or the former Groq fallback', async () => {
  for (const deployment of ['public', 'admin']) for (const modelId of ids) {
    const error = new AppError(503, 'Provider unavailable');
    error.providerRateLimited = true;
    const calls = [];
    const adapters = Object.fromEntries(['openai', 'gemini', 'cloudflare', 'grok', 'groq'].map((name) => [name, async () => { calls.push(name); throw error; }]));
    await assert.rejects(() => analyzeConfigured('Claim', { modelId }, { ...context(deployment), ...adapters }), (actual) => actual === error);
    assert.equal(calls.length, 1);
    assert.notEqual(calls[0], 'groq');
  }
  await assert.rejects(() => analyzeConfigured('Claim', {}, { ...context('public', {}), openai: async () => { throw new Error('Unconfigured model must not run'); } }), (error) => error.status === 503);
  for (const deployment of ['public', 'admin']) {
    const calls = [];
    const adapters = Object.fromEntries(['openai', 'gemini', 'cloudflare', 'grok', 'groq'].map((name) => [name, async () => { calls.push(name); return result(); }]));
    await assert.rejects(() => analyzeConfigured('Claim', {}, { ...context(deployment, { ...modelEnvironment, OPENAI_API_KEY: undefined }), ...adapters }), (error) => error.status === 503);
    assert.deepEqual(calls, [], 'Missing Luna configuration must not silently choose another available model.');
  }
});

test('local/Caddy configuration and environment-selected provider behavior remain independent of deployment environment markers', async () => {
  for (const [provider, name] of [['xai', 'grok'], ['groq', 'groq'], ['openai', 'openai']]) {
    const environment = { VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'admin', ANALYSIS_PROVIDER: provider };
    const calls = [];
    const adapters = Object.fromEntries(['grok', 'groq', 'openai'].map((key) => [key, async (_text, options) => { calls.push({ key, options }); return result(); }]));
    assert.deepEqual(await analyzeConfigured('Claim', { language: 'ru' }, { ...context('local', environment), ...adapters }), result());
    assert.deepEqual(calls, [{ key: name, options: { language: 'ru' } }]);
    assert.deepEqual(analysisConfiguration(context('local', environment)), { reasoningControls: provider === 'xai', symbolicReadings: true });
    await assert.rejects(() => analyzeConfigured('Claim', { modelId: 'luna' }, { ...context('local', environment), ...adapters }), (error) => error.status === 400);
  }
  for (const model of ['grok-4.3', 'grok-4.20-multi-agent', 'grok-4.7-other', 'other-model']) {
    assert.equal(supportsReasoning({ environment: { XAI_MODEL: model } }), false);
  }
  assert.equal(supportsReasoning({ environment: {} }), true);
  await assert.rejects(() => analyzeConfigured('Claim', { reasoningEffort: 'high' }, context('local', { ANALYSIS_PROVIDER: 'groq' })), /Grok only/);
  await assert.rejects(() => analyzeConfigured('Claim', {}, context('local', { ANALYSIS_PROVIDER: 'unsupported' })), /configure ANALYSIS_PROVIDER/);
  assert.throws(() => analysisConfiguration(context('unknown')), /deployment role/);
});

test('local Groq browser tool failures and citation checks stay fail-closed', async () => {
  const groq = (text, options) => analyzeWithGroq(text, { ...options, apiKey: 'test', fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 'tool_use_failed', failed_generation: 'private provider detail' } }) }) });
  await assert.rejects(() => analyzeConfigured('Claim', {}, { ...context('local', { ANALYSIS_PROVIDER: 'groq' }), groq }), (error) => error.status === 503 && error.providerResearchUnavailable === true && !error.message.includes('private provider detail'));
  let calls = 0;
  await assert.rejects(() => analyzeWithGroq('Claim', { apiKey: 'test', requireCitations: true, fetchImpl: async () => {
    calls++;
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'Research', executed_tools: [{ browser_results: [{ url: 'http://user:pass@example.org/' }, { url: 'file:///private' }] }] } }] }) };
  } }), /Web research is temporarily unavailable/);
  assert.equal(calls, 1);
});

test('xAI distinguishes provider rate limits from credential failures', async () => {
  await assert.rejects(() => analyzeWithGrok('Claim', { apiKey: 'test', fetchImpl: async () => ({ ok: false, status: 429 }) }), (error) => error.providerRateLimited === true);
  await assert.rejects(() => analyzeWithGrok('Claim', { apiKey: 'test', fetchImpl: async () => ({ ok: false, status: 401 }) }), (error) => error.providerRateLimited !== true);
});

test('local Groq preserves safe upstream errors without retrying another model', async () => {
  for (const scenario of ['research-400', 'analysis-tool-error', 'invalid-credentials', 'malformed-error']) {
    const calls = [];
    const fetchImpl = async (_url, options) => {
      calls.push(JSON.parse(options.body));
      if (scenario === 'analysis-tool-error' && calls.length === 1) {
        return { ok: true, json: async () => ({ choices: [{ message: { content: 'Research', executed_tools: [{ browser_results: [{ url: 'https://example.org/source' }] }] } }] }) };
      }
      return { ok: false, status: scenario === 'invalid-credentials' ? 401 : 400, json: async () => {
        if (scenario === 'malformed-error') throw new Error('private provider detail');
        return { error: { code: scenario === 'analysis-tool-error' ? 'tool_use_failed' : 'bad_request', failed_generation: 'private provider detail' } };
      } };
    };
    const groq = (text, options) => analyzeWithGroq(text, { ...options, apiKey: 'test', fetchImpl });
    await assert.rejects(() => analyzeConfigured('Claim', { model: 'openai/gpt-oss-120b' }, { ...context('local', { ANALYSIS_PROVIDER: 'groq' }), groq }), (error) => {
      assert.equal(error.status, scenario === 'invalid-credentials' ? 503 : 502);
      assert.notEqual(error.providerResearchUnavailable, true);
      assert.doesNotMatch(error.message, /private provider detail/);
      return true;
    });
    assert.equal(calls.length, scenario === 'analysis-tool-error' ? 2 : 1, scenario);
    assert.ok(calls.every((body) => body.model === 'openai/gpt-oss-120b'), scenario);
  }
});

test('all deployed adapters receive the same internal signal and deadline in both roles', async () => {
  const deadline = createDeadline(60_000);
  try {
    for (const deployment of ['public', 'admin']) for (const [modelId, adapter] of [['luna', 'openai'], ['gemini-3.8-flash', 'gemini'], ['glm-4.7-flash', 'cloudflare'], ['grok-4.7', 'grok']]) {
      let calls = 0;
      const output = await analyzeConfigured('Claim', { modelId, language: 'he', signal: deadline.signal, deadline }, {
        ...context(deployment),
        [adapter]: async (_text, options) => {
          calls++;
          assert.equal(options.signal, deadline.signal);
          assert.equal(options.deadline, deadline);
          assert.equal(options.language, 'he');
          return result();
        },
      });
      assert.equal(calls, 1);
      assert.equal(output.analysisModelId, modelId);
    }
  } finally { deadline.dispose(); }
});

test('local dispatch preserves existing provider options including internal cancellation context', async () => {
  const deadline = createDeadline(60_000);
  try {
    for (const [provider, adapter] of [['xai', 'grok'], ['openai', 'openai'], ['groq', 'groq']]) {
      const options = { language: 'ru', signal: deadline.signal, deadline };
      const output = await analyzeConfigured('Claim', options, {
        ...context('local', { ANALYSIS_PROVIDER: provider }),
        [adapter]: async (_text, forwarded) => { assert.equal(forwarded, options); return result(); },
      });
      assert.deepEqual(output, result());
    }
  } finally { deadline.dispose(); }
});

function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}

function controlledDeadline() {
  let now = 0;
  let expireTimer;
  const deadline = createDeadline(100, { now: () => now, setTimer: (callback) => { expireTimer = callback; return 0; }, clearTimer: () => {} });
  return { deadline, elapse: () => { now = 101; }, expire: () => { now = 101; expireTimer(); } };
}

test('Grok aborts fetch and body waits safely with an external signal or shared deadline', async () => {
  for (const phase of ['fetch', 'body']) for (const owned of [false, true]) {
    const budget = controlledDeadline();
    const controller = new AbortController();
    const started = deferred();
    let calls = 0;
    let requestSignal;
    const work = analyzeWithGrok('Claim', {
      apiKey: 'test', signal: owned ? budget.deadline.signal : controller.signal, ...(owned ? { deadline: budget.deadline } : {}),
      fetchImpl: async (_url, options) => {
        calls++;
        requestSignal = options.signal;
        assert.equal(Object.hasOwn(JSON.parse(options.body), 'signal'), false);
        assert.equal(Object.hasOwn(JSON.parse(options.body), 'deadline'), false);
        if (phase === 'fetch') { started.resolve(); return new Promise(() => {}); }
        return { ok: true, json: async () => { started.resolve(); return new Promise(() => {}); } };
      },
    });
    await started.promise;
    const rejected = assert.rejects(work, (error) => error.status === (owned ? 504 : 502) && !error.message.includes('private'));
    if (owned) budget.expire();
    else controller.abort(new AppError(499, 'private cancellation reason'));
    await rejected;
    assert.equal(requestSignal.aborted, true);
    assert.equal(calls, 1);
    budget.deadline.dispose();
  }
});

test('Grok checks absolute expiry before requests and after JSON/parsing without relying on timer callbacks', async (t) => {
  const parsed = JSON.stringify(result());
  for (const phase of ['before', 'body', 'parse']) {
    const budget = controlledDeadline();
    let calls = 0;
    if (phase === 'before') budget.elapse();
    const originalParse = JSON.parse;
    const mock = phase === 'parse' ? t.mock.method(JSON, 'parse', (value, ...options) => {
      const output = originalParse(value, ...options);
      if (value === parsed) budget.elapse();
      return output;
    }) : null;
    try {
      await assert.rejects(() => analyzeWithGrok('Claim', { apiKey: 'test', deadline: budget.deadline, fetchImpl: async () => {
        calls++;
        return { ok: true, json: async () => {
          if (phase === 'body') budget.elapse();
          return { output: [{ type: 'message', content: [{ type: 'output_text', text: parsed }] }] };
        } };
      } }), (error) => error.status === 504);
      assert.equal(calls, phase === 'before' ? 0 : 1);
    } finally { mock?.mock.restore(); budget.deadline.dispose(); }
  }
  const controller = new AbortController();
  controller.abort(new Error('private prior cancellation'));
  await assert.rejects(() => analyzeWithGrok('Claim', { apiKey: 'test', signal: controller.signal, fetchImpl: async () => { assert.fail('Aborted work must not start'); } }), (error) => error.status === 502 && !error.message.includes('private'));
});

test('Grok retains its 120-second request cap independently of the parent budget', async (t) => {
  const cap = new AbortController();
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => { timeouts.push(milliseconds); return cap.signal; });
  const budget = controlledDeadline();
  const started = deferred();
  const work = analyzeWithGrok('Claim', { apiKey: 'test', deadline: budget.deadline, fetchImpl: async () => { started.resolve(); return new Promise(() => {}); } });
  await started.promise;
  const rejected = assert.rejects(work, (error) => error.status === 502 && !error.message.includes('private'));
  cap.abort(new AppError(499, 'private request-cap reason'));
  await rejected;
  assert.deepEqual(timeouts, [120_000]);
  assert.equal(budget.deadline.signal.aborted, false);
  budget.deadline.dispose();
});
