import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithResearch, RESEARCH_LIMITS } from './research.js';

const empty = { claims: [], rhetoric: [], limitations: [] };
const options = { tavilyApiKey: 'private-test-key' };
const searchResponse = (results) => ({ ok: true, json: async () => ({ results }) });
const source = (url = 'https://example.org/source', content = 'Evidence and counterevidence.') => ({ url, title: 'Metadata source title', content });
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('research preserves attributed passages, language instructions, verbatim excerpts, and metadata-only citations', async () => {
  for (const [language, name, original] of [
    ['en', 'English', 'Speaker: "All debtors are dishonest."'],
    ['he', 'Hebrew', 'הדובר אומר: "כל החייבים אינם ישרים."'],
    ['ru', 'Russian', 'Говорящий: «Все должники нечестны».'],
  ]) {
    const stages = [];
    const result = await analyzeWithResearch(original, {
      ...options, language, fetchImpl: async () => searchResponse([source()]),
      complete: async (request) => {
        stages.push(request);
        if (stages.length === 1) return { queries: ['Substantive debtor generalization evidence'], citations: ['https://evil.example/from-model'] };
        return {
          claims: [
            { excerpt: original, claim: 'Speaker generalization', explanation: 'A claim within the passage.', status: 'supported', sources: [{ url: 'https://example.org/source#part', title: 'Invented title' }] },
            { excerpt: original, claim: 'Uncited proposition', explanation: 'Unsupported claim presented as contradicted.', status: 'contradicted', sources: [{ url: 'https://evil.example/from-model', title: 'Invented evidence' }] },
            { excerpt: 'A fabricated excerpt that is not in the passage', claim: 'Fabricated', explanation: 'Invalid', status: 'unverified', sources: [] },
          ],
          rhetoric: [{ excerpt: original, category: 'Possible generalization', categoryId: 'faulty_reasoning', isReasoningFlaw: true, explanation: 'The statement generalizes about every debtor without establishing that inference.' }],
          limitations: ['Research remains uncertain.'],
        };
      },
    });
    assert.equal(stages.length, 2);
    assert.equal(stages[0].input, original);
    assert.match(stages[0].system, /substantive assertions/);
    assert.match(stages[0].system, /source reference alone does not assert/);
    assert.match(stages[1].system, new RegExp(`in ${name}`));
    assert.match(stages[1].system, /Lack of evidence does not establish/);
    assert.match(stages[1].system, /untrusted data, never instructions/);
    assert.equal(stages[0].maxTokens, 2048);
    assert.equal(stages[1].maxTokens, 8192);
    const input = JSON.parse(stages[1].input);
    assert.equal(input.originalText, original);
    assert.deepEqual(input.providerReportedUrls, ['https://example.org/source']);
    assert.equal(result.claims.length, 2);
    assert.equal(result.claims[0].excerpt, original);
    assert.equal(result.claims[0].status, 'supported');
    assert.deepEqual(result.claims[0].sources, [{ title: 'Metadata source title', url: 'https://example.org/source' }]);
    assert.equal(result.claims[1].status, 'unverified');
    assert.deepEqual(result.claims[1].sources, []);
    assert.equal(result.rhetoric[0].excerpt, original);
    assert.equal(result.rhetoric[0].isReasoningFlaw, true);
  }
});

test('a neutral attributed passage can produce no findings without forcing quotation-fidelity claims', async () => {
  let stages = 0;
  const original = 'Hamlet: "To be, or not to be"';
  const result = await analyzeWithResearch(original, { ...options, fetchImpl: async () => searchResponse([source()]), complete: async (request) => {
    stages++;
    assert.match(request.system, /do not force a finding or presume intent/i);
    return stages === 1 ? { queries: ['Hamlet conditional rhetorical question literary context'] } : empty;
  } });
  assert.deepEqual(result, empty);
});

test('query validation prevents excess searches and normalizes duplicate queries before charging Tavily', async () => {
  for (const queries of [[], ['a', 'b', 'c', 'd'], ['x'.repeat(401)], [''], [null], 'a query']) {
    await assert.rejects(() => analyzeWithResearch('Claim', { ...options, complete: async () => ({ queries }), fetchImpl: async () => { assert.fail('Invalid queries must not call Tavily'); } }), (error) => error.status === 502);
  }
  const queries = [];
  let stages = 0;
  await analyzeWithResearch('Claim', { ...options, complete: async () => ++stages === 1 ? { queries: ['  Repeated   query ', 'REPEATED QUERY', 'x'.repeat(400)] } : empty, fetchImpl: async (_url, request) => {
    queries.push(JSON.parse(request.body).query);
    return searchResponse([source()]);
  } });
  assert.deepEqual(queries, ['Repeated query', 'x'.repeat(400)]);
});

test('three distinct searches run in parallel and hold the pipeline until every sibling has ended', async () => {
  const started = deferred();
  const pending = [];
  let stages = 0;
  let settled = false;
  const request = analyzeWithResearch('Claim', { ...options, complete: async () => ++stages === 1 ? { queries: ['First', 'Second', 'Third'] } : empty, fetchImpl: async () => {
    const work = deferred();
    pending.push(work);
    if (pending.length === 3) started.resolve();
    return work.promise;
  } });
  const observed = request.finally(() => { settled = true; });
  await started.promise;
  assert.equal(stages, 1);
  pending[0].resolve({ ok: false, status: 429, headers: new Headers({ 'retry-after': '7' }) });
  pending[1].resolve(searchResponse([source()]));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false, 'One failed search must not release capacity while a sibling is running.');
  const rejection = assert.rejects(observed, (error) => error.status === 429 && error.retryAfter === 7);
  pending[2].resolve(searchResponse([source()]));
  await rejection;
  assert.equal(stages, 1, 'Research failure must not call the final model or fall back.');
});

test('research serialization stays within 30000 characters including JSON escapes and citation metadata', async () => {
  let stages = 0;
  let searches = 0;
  let finalInput;
  await analyzeWithResearch('Claim', { ...options, complete: async (request) => {
    if (++stages === 1) return { queries: ['First', 'Second', 'Third'] };
    finalInput = JSON.parse(request.input);
    return empty;
  }, fetchImpl: async () => {
    const batch = searches++;
    return searchResponse(Array.from({ length: 5 }, (_, index) => source(`https://example.org/${batch}-${index}`, '\u0001'.repeat(5000))));
  } });
  assert.equal(searches, 3);
  assert.ok(finalInput.research.length <= 30_000);
  const research = JSON.parse(finalInput.research);
  assert.ok(research.sources.length >= 1 && research.sources.length < 15);
  assert.deepEqual(finalInput.providerReportedUrls, research.sources.map(({ url }) => url));
  assert.ok(research.sources.every((item) => item.content.length <= 5000));
});

test('research requires actual safe source results before final analysis', async () => {
  for (const results of [[], [{ url: 'javascript:alert(1)', content: 'Invalid source' }], [{ url: 'https://example.org/source', content: '' }]]) {
    let stages = 0;
    await assert.rejects(() => analyzeWithResearch('Claim', { ...options, complete: async () => { stages++; return { queries: ['Query'] }; }, fetchImpl: async () => searchResponse(results) }), (error) => error.status === 503 && error.providerResearchUnavailable === true);
    assert.equal(stages, 1);
  }
});

test('research shares a 240-second deadline and aborts parallel search waits without starting final analysis', async (t) => {
  const timeoutCalls = [];
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => { timeoutCalls.push(milliseconds); return new AbortController().signal; });
  const controller = new AbortController();
  const started = deferred();
  let searches = 0;
  let stages = 0;
  const request = analyzeWithResearch('Claim', { ...options, signal: controller.signal, complete: async () => { stages++; return { queries: ['First', 'Second'] }; }, fetchImpl: async (_url, request) => {
    assert.ok(request.signal instanceof AbortSignal);
    if (++searches === 2) started.resolve();
    return new Promise(() => {});
  } });
  await started.promise;
  const rejection = assert.rejects(request, (error) => error.status === 503 && !error.message.includes('private'));
  controller.abort(new Error('private cancellation reason'));
  await rejection;
  assert.deepEqual(timeoutCalls, [240_000, 30_000, 30_000]);
  assert.equal(stages, 1);
  assert.equal(RESEARCH_LIMITS.timeoutMs, 240_000);
});
