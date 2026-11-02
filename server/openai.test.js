import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithOpenAI } from './openai.js';
import { createDeadline } from './deadline.js';

const text = 'דובר אמר: ״הנהר עלה בשנה שעברה.״';
const research = {
  status: 'completed',
  output: [
    { type: 'web_search_call', status: 'completed', action: { type: 'search' } },
    { type: 'message', content: [{ type: 'output_text', text: 'A report documents the river: https://example.org/report.', annotations: [
      { type: 'url_citation', url: 'https://example.org/report#one', title: 'Report' },
      { type: 'not_a_url_citation', url: 'https://example.org/forged' },
      { type: 'url_citation', url: 'javascript:alert(1)' },
    ] }] },
  ],
};
const analysis = {
  claims: [
    { excerpt: 'הנהר עלה בשנה שעברה.', claim: 'הנהר עלה', status: 'supported', explanation: 'A report supports this.', sources: [
      { title: 'Report', url: 'https://example.org/report#two' },
      { title: 'Forged', url: 'https://example.org/forged' },
    ] },
    { excerpt: 'הנהר עלה בשנה שעברה.', claim: '  הנהר   עלה ', status: 'supported', explanation: 'Duplicate.', sources: [{ title: 'Report', url: 'https://example.org/report' }] },
    { excerpt: 'דובר אמר', claim: 'unsupported', status: 'supported', explanation: 'Unsupported assertion', sources: [{ title: 'Invented', url: 'https://example.org/invented' }] },
    { excerpt: 'דובר', claim: 'unsourced uncertainty', status: 'unverified', explanation: 'A web report secretly asserts a factual claim.', sources: [] },
    { excerpt: 'not present', claim: 'fabricated', status: 'supported', explanation: 'bad', sources: [] },
  ],
  rhetoric: [{ category: 'Research contamination', categoryId: 'other', isReasoningFlaw: false, excerpt: 'דובר', explanation: 'Should not appear.' }],
  limitations: ['This came from external research and must be discarded.'],
};
const rhetoric = {
  claims: [
    { excerpt: 'הנהר עלה בשנה שעברה.', claim: '  הנהר    עלה  ', status: 'supported', explanation: 'Ignored', sources: [{ title: 'Report', url: 'https://example.org/report' }] },
    { excerpt: 'הנהר עלה בשנה שעברה.', claim: 'The event happened last year', status: 'supported', explanation: 'Ignored', sources: [{ title: 'Report', url: 'https://example.org/report' }] },
    { excerpt: 'דובר', claim: 'Passage-only assertion', status: 'supported', explanation: 'Ignored', sources: [{ title: 'Report', url: 'https://example.org/report' }] },
    { excerpt: 'דובר', claim: '  PASSAGE-only   assertion ', status: 'unverified', explanation: 'Ignored', sources: [] },
    { excerpt: 'Invented excerpt', claim: 'Invalid', status: 'unverified', explanation: 'Ignored', sources: [] },
  ],
  rhetoric: [{ category: 'Observation', categoryId: 'other', isReasoningFlaw: false, excerpt: 'דובר אמר', explanation: 'The statement is attributed to a speaker.' }],
  limitations: ['Interpretation can vary.'],
};
const resultResponse = (value) => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value), annotations: [] }] }] });
const ok = (body) => ({ ok: true, status: 200, json: async () => body });

test('Luna discards unsourced research claims and combines only distinct passage-only claims', async () => {
  const requests = [];
  const result = await analyzeWithOpenAI(text, { apiKey: 'test-key', language: 'he', fetchImpl: async (url, options) => {
    requests.push({ url, headers: options.headers, body: JSON.parse(options.body) });
    return ok(requests.length === 1 ? research : resultResponse(requests.length === 2 ? analysis : rhetoric));
  } });
  assert.equal(requests.length, 3);
  assert.ok(requests.every(({ url, body }) => url === 'https://api.openai.com/v1/responses' && body.model === 'gpt-6-luna' && body.store === false));
  assert.equal(requests[0].headers.authorization, 'Bearer test-key');
  assert.equal(requests[0].body.tool_choice, 'required');
  assert.equal(requests[0].body.max_tool_calls, 3);
  assert.deepEqual(requests[0].body.tools, [{ type: 'web_search' }]);
  assert.match(requests[0].body.input[0].content, /substantive assertions/);
  assert.match(requests[1].body.input[0].content, /Hebrew/i);
  assert.equal(requests[1].body.text.format.strict, true);
  assert.equal(requests[1].body.text.format.name, 'rhetoric_analysis');
  const modelInput = JSON.parse(requests[1].body.input[1].content);
  assert.equal(modelInput.originalText, text);
  assert.deepEqual(modelInput.providerReportedUrls, ['https://example.org/report']);
  assert.equal(requests[2].body.input[1].content, text);
  assert.doesNotMatch(JSON.stringify(requests[2].body), /example\.org|A report documents the river/);
  assert.match(requests[2].body.input[0].content, /Do not rely on outside information/);
  assert.deepEqual(result.claims.map((claim) => claim.excerpt), ['הנהר עלה בשנה שעברה.', 'הנהר עלה בשנה שעברה.', 'דובר']);
  assert.deepEqual(result.claims[0].sources, [{ title: 'Report', url: 'https://example.org/report' }]);
  assert.equal(result.claims[1].status, 'unverified');
  assert.deepEqual(result.claims[1].sources, []);
  assert.equal(result.claims[1].claim, 'The event happened last year');
  assert.equal(result.claims[2].claim, 'Passage-only assertion');
  assert.doesNotMatch(result.claims[1].explanation, /web report|factual claim|Ignored/);
  assert.ok(result.claims.every((claim) => !['unsupported', 'unsourced uncertainty'].includes(claim.claim)));
  assert.equal(result.rhetoric[0].category, 'Observation');
  assert.deepEqual(result.limitations, []);
});

test('suppresses an attributed numerical paraphrase but preserves a distinct claim from the same excerpt', async () => {
  const original = 'A speaker said: “Water freezes at zero degrees Celsius at standard atmospheric pressure.”';
  const excerpt = 'Water freezes at zero degrees Celsius at standard atmospheric pressure.';
  const sourceClaim = { excerpt, claim: 'Water freezes at 0 °C at standard atmospheric pressure', status: 'supported', explanation: 'Source supports it.', sources: [{ title: 'Report', url: 'https://example.org/report' }] };
  const passageResponse = {
    claims: [
      { ...sourceClaim, claim: 'The speaker asserts that water freezes at zero degrees Celsius at standard atmospheric pressure' },
      { ...sourceClaim, claim: 'Standard atmospheric pressure is specified' },
    ],
    rhetoric: [],
    limitations: ['No external evidence is used.'],
  };
  let calls = 0;
  const output = await analyzeWithOpenAI(original, { apiKey: 'test', fetchImpl: async () => {
    calls++;
    return ok(calls === 1 ? research : resultResponse(calls === 2 ? { claims: [sourceClaim], rhetoric: [], limitations: [] } : passageResponse));
  } });
  assert.deepEqual(output.claims.map((item) => item.claim), [sourceClaim.claim, 'Standard atmospheric pressure is specified']);
  assert.equal(output.claims[0].status, 'supported');
  assert.equal(output.claims[1].status, 'unverified');
  assert.deepEqual(output.claims[1].sources, []);
  assert.deepEqual(output.limitations, []);
});

test('deduplication preserves numeric signs, decimal boundaries and comparison operators', async () => {
  const excerpt = 'Measurements include -5, +5, 5, 1.5, 1 5, >=5 and <=5.';
  const claim = (summary) => ({ excerpt, claim: summary, status: 'supported', explanation: 'Source', sources: [{ title: 'Report', url: 'https://example.org/report' }] });
  const sourced = ['Value is -5', 'Value is 1.5', 'Value >=5'].map(claim);
  const passage = ['The speaker states that value is -5', 'Value is 5', 'Value is +5', 'Value is 1 5', 'Value <=5'].map(claim);
  let calls = 0;
  const output = await analyzeWithOpenAI(excerpt, { apiKey: 'test', fetchImpl: async () => {
    calls++;
    return ok(calls === 1 ? research : resultResponse(calls === 2
      ? { claims: sourced, rhetoric: [], limitations: [] }
      : { claims: passage, rhetoric: [], limitations: [] }));
  } });
  assert.deepEqual(output.claims.map((item) => item.claim), [
    'Value is -5', 'Value is 1.5', 'Value >=5', 'Value is 5', 'Value is +5', 'Value is 1 5', 'Value <=5',
  ]);
});

test('research fails closed when web search was not performed or produced no annotated URL', async () => {
  for (const bad of [
    { status: 'completed', output: research.output.slice(1) },
    { status: 'completed', output: [{ type: 'web_search_call', status: 'completed' }, { type: 'message', content: [{ type: 'output_text', text: 'https://example.org/invented', annotations: [] }] }] },
  ]) {
    let calls = 0;
    await assert.rejects(() => analyzeWithOpenAI('Claim', { apiKey: 'test', fetchImpl: async () => { calls++; return ok(bad); } }),
      (error) => error.status === 503 && error.providerResearchUnavailable === true);
    assert.equal(calls, 1);
  }
});

test('claim and rhetoric analyses begin concurrently after research completes', async () => {
  const pending = [];
  let calls = 0;
  const resultPromise = analyzeWithOpenAI(text, { apiKey: 'test', fetchImpl: async () => {
    calls++;
    if (calls === 1) return ok(research);
    return new Promise((resolve) => pending.push(resolve));
  } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 2);
  pending[0](ok(resultResponse(analysis)));
  pending[1](ok(resultResponse(rhetoric)));
  const result = await resultPromise;
  assert.equal(result.rhetoric[0].category, 'Observation');
});

test('a failed analysis waits for its concurrent sibling before the request rejects', async () => {
  let calls = 0;
  let finishRhetoric;
  let settled = false;
  const result = analyzeWithOpenAI(text, { apiKey: 'test', fetchImpl: async () => {
    calls++;
    if (calls === 1) return ok(research);
    if (calls === 2) return { ok: false, status: 500 };
    return new Promise((resolve) => { finishRhetoric = resolve; });
  } }).then(() => { settled = true; return null; }, (error) => { settled = true; return error; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 3);
  assert.equal(settled, false);
  finishRhetoric(ok(resultResponse(rhetoric)));
  const error = await result;
  assert.match(error.message, /could not complete the request/);
  assert.equal(settled, true);
});

test('explicit fidelity claims can retain citations without inventing findings for a neutral Russian quotation', async () => {
  const cases = [
    { original: 'The quotation “To be, or not to be” appears in Hamlet.', language: 'en', excerpt: '“To be, or not to be”', claim: 'The quotation appears in Hamlet.', status: 'supported' },
    { original: 'Оратор сказал: «Вода замерзает при нуле градусов Цельсия».', language: 'ru', excerpt: 'Вода замерзает при нуле градусов Цельсия', claim: 'Вода замерзает при нуле градусов.', status: 'unverified' },
  ];
  for (const sample of cases) {
    const bodies = [];
    const answer = { claims: [{ excerpt: sample.excerpt, claim: sample.claim, status: sample.status, explanation: 'Context', sources: sample.status === 'supported' ? [{ title: 'source', url: 'https://example.org/report' }] : [] }], rhetoric: [], limitations: [] };
    const output = await analyzeWithOpenAI(sample.original, { apiKey: 'test', language: sample.language, fetchImpl: async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      return ok(bodies.length === 1 ? research : resultResponse(bodies.length === 2 ? answer : { claims: answer.claims, rhetoric: [], limitations: [] }));
    } });
    assert.equal(output.claims[0].excerpt, sample.excerpt);
    assert.equal(output.claims[0].status, sample.status);
    assert.equal(output.claims[0].sources.length, sample.status === 'supported' ? 1 : 0);
    assert.match(bodies[0].input[0].content, /If the input explicitly raises quotation accuracy/);
    assert.equal(bodies[0].input[1].content, sample.original);
    if (sample.language === 'ru') assert.match(bodies[1].input[0].content, /Russian/i);
  }
});

test('credential, rate-limit and upstream failures do not expose provider errors', async () => {
  await assert.rejects(() => analyzeWithOpenAI('Claim', { apiKey: '' }), /configure OPENAI_API_KEY/);
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(() => analyzeWithOpenAI('Claim', { apiKey: 'test', fetchImpl: async () => ({ ok: false, status, json: async () => ({ error: 'private provider detail' }) }) }), (error) => {
      assert.doesNotMatch(error.message, /private provider detail/);
      if (status === 429) assert.equal(error.providerRateLimited, true);
      return true;
    });
  }
});

test('incomplete and refusal responses are not accepted as successful analyses', async () => {
  const failures = [
    { status: 'incomplete', output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Cannot do that.' }] }] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{invalid' }] }] },
  ];
  for (const failure of failures) {
    let calls = 0;
    await assert.rejects(() => analyzeWithOpenAI('Claim', { apiKey: 'test', fetchImpl: async () => ok(++calls === 1 ? research : failure) }), /incomplete result/);
  }
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

test('OpenAI aborts fetch and body waits without starting later analysis stages or exposing raw cancellation reasons', async () => {
  for (const phase of ['fetch', 'body']) for (const owned of [false, true]) {
    const started = deferred();
    const controller = new AbortController();
    const budget = controlledDeadline();
    const signal = owned ? budget.deadline.signal : controller.signal;
    let calls = 0;
    let requestSignal;
    const work = analyzeWithOpenAI(text, { apiKey: 'test', signal, ...(owned ? { deadline: budget.deadline } : {}), fetchImpl: async (_url, options) => {
      calls++;
      requestSignal = options.signal;
      assert.equal(Object.hasOwn(JSON.parse(options.body), 'signal'), false);
      assert.equal(Object.hasOwn(JSON.parse(options.body), 'deadline'), false);
      if (phase === 'fetch') { started.resolve(); return new Promise(() => {}); }
      return { ok: true, json: async () => { started.resolve(); return new Promise(() => {}); } };
    } });
    await started.promise;
    const rejected = assert.rejects(work, (error) => error.status === (owned ? 504 : 502) && !error.message.includes('private'));
    if (owned) budget.expire();
    else controller.abort(new Error('private cancellation reason'));
    await rejected;
    assert.equal(requestSignal.aborted, true);
    assert.equal(calls, 1);
    budget.deadline.dispose();
  }
});

test('OpenAI checks expired budgets before requests and after research JSON even when the timer cannot run', async () => {
  for (const phase of ['before', 'body']) {
    const budget = controlledDeadline();
    let calls = 0;
    if (phase === 'before') budget.elapse();
    await assert.rejects(() => analyzeWithOpenAI(text, { apiKey: 'test', deadline: budget.deadline, fetchImpl: async () => {
      calls++;
      return { ok: true, json: async () => { budget.elapse(); return research; } };
    } }), (error) => error.status === 504);
    assert.equal(calls, phase === 'before' ? 0 : 1);
    budget.deadline.dispose();
  }
  const controller = new AbortController();
  controller.abort(new Error('private prior cancellation'));
  await assert.rejects(() => analyzeWithOpenAI(text, { apiKey: 'test', signal: controller.signal, fetchImpl: async () => { assert.fail('Aborted work must not start'); } }), (error) => error.status === 502 && !error.message.includes('private'));
});

test('OpenAI cancellation settles both concurrent analysis requests under the same parent deadline', async () => {
  const budget = controlledDeadline();
  const started = deferred();
  const active = [];
  let calls = 0;
  let bodyStarted = false;
  const ready = () => { if (calls === 3 && bodyStarted) started.resolve(); };
  const work = analyzeWithOpenAI(text, { apiKey: 'test', deadline: budget.deadline, signal: budget.deadline.signal, fetchImpl: async (_url, options) => {
    calls++;
    if (calls === 1) return ok(research);
    active.push(options.signal);
    if (calls === 2) return { ok: true, json: async () => { bodyStarted = true; ready(); return new Promise(() => {}); } };
    ready();
    return new Promise(() => {});
  } });
  await started.promise;
  const rejected = assert.rejects(work, (error) => error.status === 504);
  budget.expire();
  await rejected;
  assert.equal(calls, 3);
  assert.equal(active.length, 2);
  assert.ok(active.every((signal) => signal.aborted));
  budget.deadline.dispose();
});

test('OpenAI checks absolute expiry after structured JSON parsing before parsing or validating later results', async (t) => {
  const budget = controlledDeadline();
  const originalParse = JSON.parse;
  const factual = JSON.stringify(analysis);
  let parses = 0;
  t.mock.method(JSON, 'parse', (value, ...options) => {
    const output = originalParse(value, ...options);
    parses++;
    if (value === factual) budget.elapse();
    return output;
  });
  let calls = 0;
  await assert.rejects(() => analyzeWithOpenAI(text, { apiKey: 'test', deadline: budget.deadline, fetchImpl: async () => ok(++calls === 1 ? research : resultResponse(calls === 2 ? analysis : rhetoric)) }), (error) => error.status === 504);
  assert.equal(calls, 3);
  assert.equal(parses, 1);
  budget.deadline.dispose();
});

test('OpenAI retains the per-request 120-second cap within a longer parent budget', async (t) => {
  const cap = new AbortController();
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => { timeouts.push(milliseconds); return cap.signal; });
  const budget = controlledDeadline();
  const started = deferred();
  const work = analyzeWithOpenAI(text, { apiKey: 'test', deadline: budget.deadline, fetchImpl: async () => { started.resolve(); return new Promise(() => {}); } });
  await started.promise;
  const rejected = assert.rejects(work, (error) => error.status === 502);
  cap.abort(new Error('private request-cap reason'));
  await rejected;
  assert.deepEqual(timeouts, [120_000]);
  assert.equal(budget.deadline.signal.aborted, false);
  budget.deadline.dispose();
});
