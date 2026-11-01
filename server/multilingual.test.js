import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { AppError } from './errors.js';
import { analyzeConfigured } from './provider.js';
import { analyzeWithGrok, rhetoricCategories, schema, validatedResult } from './grok.js';
import { analyzeWithGroq } from './groq.js';
import { localize, outputLanguageInstruction, requestLanguage } from './localization.js';

const emptyResult = () => ({ claims: [], rhetoric: [], limitations: [] });

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try { return await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

async function post(base, body, headers = {}) {
  const response = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json(), retryAfter: response.headers.get('retry-after') };
}

async function withEnvironment(values, run) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { return await run(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('API validates language before quota or URL extraction and returns the exact analyzed source', async () => {
  let acquisitions = 0;
  let extractions = 0;
  const seen = [];
  const article = 'זו כתבה בעברית. Это статья на русском. A mixed-language article.';
  const app = createApp({
    deployment: 'public',
    sharedLimiter: { acquire: async () => { acquisitions++; return async () => {}; } },
    extract: async () => { extractions++; return article; },
    analyze: async (text, options) => { seen.push({ text, options }); return { ...emptyResult(), sourceText: 'untrusted provider value' }; },
  });
  await withServer(app, async (base) => {
    const headers = { 'x-forwarded-for': '8.8.8.8' };
    for (const language of ['de', '', null, 1, ['he'], {}]) {
      assert.equal((await post(base, { type: 'url', content: 'https://example.org/article', language }, headers)).status, 400);
    }
    assert.equal(acquisitions, 0);
    assert.equal(extractions, 0);
    for (const language of ['en', 'he', 'ru']) {
      const content = `  שלום עולם. Привет, мир. ${language}\n  `;
      const response = await post(base, { type: 'text', content, language }, headers);
      assert.equal(response.status, 200);
      assert.equal(response.body.sourceText, content.trim());
      assert.equal(seen.at(-1).options.language, language);
    }
    const response = await post(base, { type: 'url', content: 'https://example.org/article', language: 'ru' }, headers);
    assert.equal(response.body.sourceText, article);
    assert.equal(seen.at(-1).text, article);
    await post(base, { type: 'text', content: 'Legacy request' }, headers);
    assert.equal(Object.hasOwn(seen.at(-1).options, 'language'), false);
  });
});

test('HTTP errors localize validation, URL failures and store failures without changing the error shape or retry header', async () => {
  const busy = new AppError(429, 'Too many analyses. Please try again later.');
  busy.retryAfter = 17;
  const app = createApp({ deployment: 'public', sharedLimiter: { acquire: async () => { throw busy; } } });
  await withServer(app, async (base) => {
    const headers = { 'x-forwarded-for': '8.8.8.8' };
    for (const language of ['he', 'ru']) {
      const invalid = await post(base, { type: 'text', content: '', language }, headers);
      assert.deepEqual(invalid.body, { error: localize('Enter text or a public article URL to analyze.', language) });
      assert.notEqual(invalid.body.error, 'Enter text or a public article URL to analyze.');
      const url = await post(base, { type: 'url', content: 'http://127.0.0.1/', language }, headers);
      assert.deepEqual(url.body, { error: localize('The URL must point to a public website.', language) });
      const limited = await post(base, { type: 'text', content: 'A claim', language }, headers);
      assert.equal(limited.status, 429);
      assert.equal(limited.retryAfter, '17');
      assert.deepEqual(limited.body, { error: localize(busy.message, language) });
    }
    const malformed = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json', 'accept-language': 'he' }, body: '{' });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: localize('The request could not be read.', 'he') });
  });
});

test('language is forwarded through the free model, administrator fallback and direct local providers', async () => {
  await withEnvironment({ VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'public', SOPHIA_GROQ_FREE_CONFIRMED: 'true' }, async () => {
    const calls = [];
    await analyzeConfigured('טענה', { language: 'he' }, { groq: async (_text, options) => {
      calls.push(options);
      return emptyResult();
    } });
    assert.deepEqual(calls.map(({ model, language }) => ({ model, language })), [
      { model: 'openai/gpt-oss-120b', language: 'he' },
    ]);
    process.env.SOPHIA_DEPLOYMENT_ROLE = 'admin';
    const adminCalls = [];
    const error = new AppError(503, 'Rate limited');
    error.providerRateLimited = true;
    const admin = await analyzeConfigured('Утверждение', { language: 'ru', reasoningEffort: 'high' }, {
      grok: async (_text, options) => { adminCalls.push(options); throw error; },
      groq: async (_text, options) => { adminCalls.push(options); return emptyResult(); },
    });
    assert.deepEqual(adminCalls.map(({ language }) => language), ['ru', 'ru']);
    assert.equal(adminCalls[0].reasoningEffort, 'high');
    assert.equal(Object.hasOwn(adminCalls[1], 'reasoningEffort'), false);
    assert.equal(admin.limitations[0], localize('Grok reached its usage limit, so a free research model was used.', 'ru'));
  });
  await withEnvironment({ VERCEL: undefined, ANALYSIS_PROVIDER: 'groq' }, async () => {
    const seen = [];
    const providers = { groq: async (_text, options) => { seen.push(options); return emptyResult(); }, grok: async (_text, options) => { seen.push(options); return emptyResult(); } };
    await analyzeConfigured('Text', { language: 'he' }, providers);
    process.env.ANALYSIS_PROVIDER = 'xai';
    await analyzeConfigured('Text', { language: 'ru' }, providers);
    assert.deepEqual(seen, [{ language: 'he' }, { language: 'ru' }]);
  });
});

test('both provider prompts select output language while preserving original Unicode excerpts and strict category fields', async () => {
  const text = 'הירח מקיף את כדור הארץ. Луна обращается вокруг Земли.';
  const excerpt = 'Луна обращается вокруг Земли.';
  const analysis = { claims: [], rhetoric: [{ category: 'Наблюдение', categoryId: 'other', isReasoningFlaw: false, excerpt, explanation: 'Это наблюдение.' }], limitations: [] };
  let grokBody;
  const grok = await analyzeWithGrok(text, { apiKey: 'test', language: 'ru', fetchImpl: async (_url, options) => {
    grokBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(analysis) }] }] }) };
  } });
  assert.match(grokBody.input[0].content, /in Russian/);
  assert.match(grokBody.input[0].content, /never translate excerpts/);
  assert.equal(grokBody.input[1].content, text);
  assert.equal(grok.rhetoric[0].excerpt, excerpt);
  const bodies = [];
  const groq = await analyzeWithGroq(text, { apiKey: 'test', language: 'he', fetchImpl: async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ choices: [{ message: { content: bodies.length === 1 ? 'Research' : JSON.stringify(analysis) } }] }) };
  } });
  assert.match(bodies[1].messages[0].content, /in Hebrew/);
  assert.equal(JSON.parse(bodies[1].messages[1].content).originalText, text);
  assert.equal(groq.rhetoric[0].excerpt, excerpt);
  assert.equal(groq.limitations[0], localize('The research service did not provide verifiable source links; factual claims remain unverified.', 'he'));
  assert.deepEqual(schema.properties.rhetoric.items.properties.categoryId.enum, rhetoricCategories);
  assert.ok(schema.properties.rhetoric.items.required.includes('isReasoningFlaw'));
});

test('validation keeps authentic multilingual excerpts, normalizes categories safely and requires explanation for reasoning flags', () => {
  const original = 'שלום. Привет. Hello.';
  const observation = { category: 'Technique', excerpt: 'Привет.', explanation: 'Specific invalid inference.' };
  const output = validatedResult({ claims: [
    { excerpt: 'שלום.', claim: 'טענה', status: 'supported', explanation: 'A claim without citations', sources: [] },
  ], rhetoric: [
    observation,
    { ...observation, categoryId: 'invented', isReasoningFlaw: true },
    { ...observation, categoryId: 'faulty_reasoning', isReasoningFlaw: true },
    { ...observation, categoryId: 'faulty_reasoning', isReasoningFlaw: true, explanation: '   ' },
    { ...observation, categoryId: 'demagogy', isReasoningFlaw: 'true' },
    { ...observation, excerpt: 'Translated and absent', categoryId: 'other', isReasoningFlaw: false },
  ], limitations: [] }, {}, original, 'he');
  assert.equal(output.claims[0].status, 'unverified');
  assert.equal(output.claims[0].explanation, localize('No independently cited evidence was available for this claim.', 'he'));
  assert.equal(output.rhetoric.length, 5);
  assert.deepEqual(output.rhetoric.map(({ categoryId, isReasoningFlaw }) => ({ categoryId, isReasoningFlaw })), [
    { categoryId: 'other', isReasoningFlaw: false }, { categoryId: 'other', isReasoningFlaw: false },
    { categoryId: 'faulty_reasoning', isReasoningFlaw: true }, { categoryId: 'faulty_reasoning', isReasoningFlaw: false },
    { categoryId: 'demagogy', isReasoningFlaw: false },
  ]);
});

test('locale helpers preserve legacy messages, prefer a valid body language and translate bounded retry notices', () => {
  assert.equal(outputLanguageInstruction(undefined), '');
  assert.match(outputLanguageInstruction('en'), /in English/);
  assert.equal(localize('Original message', undefined), 'Original message');
  assert.equal(requestLanguage({ body: { language: 'ru' }, headers: { 'accept-language': 'he' } }), 'ru');
  assert.equal(requestLanguage({ headers: { 'accept-language': 'he-IL, en;q=0.9' } }), 'he');
  assert.equal(requestLanguage({ headers: { 'accept-language': 'de' } }), undefined);
  for (const language of ['he', 'ru']) {
    const message = localize("Groq's usage limit was reached. Please try again in 12 seconds.", language);
    assert.match(message, /12/);
    assert.doesNotMatch(message, /Please try again/);
  }
});
