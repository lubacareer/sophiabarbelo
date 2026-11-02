import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { createDeadline } from './deadline.js';
import { analyzeWithResearch } from './research.js';
import { localize } from './localization.js';
import { modelEnvironment } from '../test-support/models.js';

const empty = { claims: [], rhetoric: [], limitations: [] };
const article = 'A public article with enough readable text for analysis.';
function deferred() { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; }
async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try { return await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
function post(base, body) {
  return fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.4' }, body: JSON.stringify(body) });
}
function controlledDeadline() {
  let clock = 0;
  let expire;
  const deadline = createDeadline(280_000, { now: () => clock, setTimer: (callback) => { expire = callback; return 1; }, clearTimer: () => {} });
  return { deadline, advance: (milliseconds) => { clock = milliseconds; }, expire: () => expire() };
}

test('a URL request includes quota and extraction time and passes only thirty seconds to research', async () => {
  const timing = controlledDeadline();
  let releases = 0;
  let stages = 0;
  const app = createApp({ deployment: 'public', modelEnvironment, deadlineFactory: () => timing.deadline,
    sharedLimiter: { acquire: async () => { assert.equal(timing.deadline.remainingMs(), 280_000); timing.advance(5_000); return async () => { releases++; }; } },
    extract: async (_url, { deadline, signal }) => { assert.equal(deadline, timing.deadline); assert.equal(signal, deadline.signal); assert.equal(deadline.remainingMs(), 275_000); timing.advance(250_000); return article; },
    analyze: (text, options) => analyzeWithResearch(text, { ...options, tavilyApiKey: 'test-key',
      complete: async ({ deadline }) => { stages++; assert.ok(deadline.remainingMs() <= 30_000); return stages === 1 ? { queries: ['Relevant evidence'] } : empty; },
      fetchImpl: async () => ({ ok: true, json: async () => ({ results: [{ url: 'https://example.org/source', title: 'Source', content: 'Evidence' }] }) }),
    }),
  });
  await withServer(app, async (base) => {
    const response = await post(base, { type: 'url', content: 'https://example.org/article', modelId: 'glm-4.7-flash' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).sourceText, article);
  });
  assert.equal(stages, 2);
  assert.equal(releases, 1);
});

test('timeout waits for cooperative cleanup before releasing a lease and returns localized 504', async () => {
  for (const language of ['en', 'he', 'ru']) {
    const timing = controlledDeadline();
    const started = deferred();
    const abortSeen = deferred();
    const cleanup = deferred();
    let released = 0;
    const app = createApp({ deployment: 'public', modelEnvironment, deadlineFactory: () => timing.deadline,
      sharedLimiter: { acquire: async () => async () => { released++; assert.equal(timing.deadline.signal.aborted, true); } },
      analyze: async (_text, { signal }) => {
        started.resolve();
        await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
        abortSeen.resolve();
        await cleanup.promise;
        signal.throwIfAborted();
      },
    });
    await withServer(app, async (base) => {
      const pending = post(base, { type: 'text', content: 'A claim', language });
      await started.promise;
      timing.expire();
      await abortSeen.promise;
      assert.equal(released, 0, 'No outer timeout race may release capacity before work settles.');
      cleanup.resolve();
      const response = await pending;
      assert.equal(response.status, 504);
      assert.deepEqual(await response.json(), { error: localize('The analysis took too long. Please try again.', language) });
      assert.equal(released, 1);
    });
  }
});

test('expiry after extraction or late analysis prevents later work and late success in both deployed roles', async () => {
  for (const deployment of ['public', 'admin']) for (const phase of ['extract', 'analyze']) {
    const timing = controlledDeadline();
    let analyses = 0;
    let releases = 0;
    const app = createApp({ deployment, modelEnvironment, deadlineFactory: () => timing.deadline,
      sharedLimiter: { acquire: async () => async () => { releases++; } },
      extract: async () => { if (phase === 'extract') timing.advance(280_000); return article; },
      analyze: async () => { analyses++; timing.advance(280_000); return empty; },
    });
    await withServer(app, async (base) => { assert.equal((await post(base, { type: 'url', content: 'https://example.org/article' })).status, 504); });
    assert.equal(analyses, phase === 'extract' ? 0 : 1);
    assert.equal(releases, deployment === 'public' ? 1 : 0);
  }
});

test('invalid requests remain uncharged and local requests retain their existing options', async () => {
  let acquisitions = 0;
  await withServer(createApp({ deployment: 'public', modelEnvironment, sharedLimiter: { acquire: async () => { acquisitions++; return async () => {}; } } }), async (base) => {
    assert.equal((await post(base, { type: 'text', content: '' })).status, 400);
    assert.equal((await post(base, { type: 'text', content: 'Claim', modelId: 'unknown' })).status, 400);
  });
  assert.equal(acquisitions, 0);
  await withServer(createApp({ deadlineFactory: () => assert.fail('Local requests must not acquire a deployed deadline'), analyze: async (_text, options) => { assert.equal(options.deadline, undefined); assert.equal(options.signal, undefined); return empty; } }), async (base) => {
    assert.equal((await post(base, { type: 'text', content: 'Claim' })).status, 200);
  });
});
