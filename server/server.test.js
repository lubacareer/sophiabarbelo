import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from './app.js';
import { extractArticle, isPublicAddress, parsePublicUrl, resolvePublic } from './article.js';
import { analyzeWithGrok } from './grok.js';
import { AppError } from './errors.js';

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try { return await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

async function post(base, data) {
  const response = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  return { status: response.status, body: await response.json() };
}

test('API validates input and routes text and URLs', async () => {
  const seen = [];
  const app = createApp({ extract: async (url) => { seen.push(url); return 'Article text'; }, analyze: async (text) => ({ claims: [], rhetoric: [], limitations: [text] }) });
  await withServer(app, async (base) => {
    assert.equal((await post(base, { type: 'text', content: '   ' })).status, 400);
    assert.equal((await post(base, { type: 'other', content: 'hello' })).status, 400);
    assert.equal((await post(base, { type: 'text', content: 'x'.repeat(30_001) })).status, 400);
    assert.deepEqual((await post(base, { type: 'text', content: ' Hello ' })).body.limitations, ['Hello']);
    assert.deepEqual((await post(base, { type: 'url', content: 'https://example.org/article' })).body.limitations, ['Article text']);
    assert.deepEqual(seen, ['https://example.org/article']);
  });
});

test('API returns clear expected failures without exposing internal errors', async () => {
  const app = createApp({ extract: async () => { throw new AppError(422, 'Cannot read article.'); }, analyze: async () => { throw new Error('secret'); } });
  await withServer(app, async (base) => {
    assert.deepEqual(await post(base, { type: 'url', content: 'https://example.org' }), { status: 422, body: { error: 'Cannot read article.' } });
    assert.deepEqual(await post(base, { type: 'text', content: 'Hello' }), { status: 500, body: { error: 'Something went wrong. Please try again.' } });
  });
});

test('API rejects attacker-controlled Host headers to protect local requests', async () => {
  const app = createApp({ analyze: async () => ({ claims: [], rhetoric: [], limitations: [] }) });
  await withServer(app, async (base) => {
    const status = await new Promise((resolve, reject) => {
      const req = http.request(`${base}/api/analyze`, { method: 'POST', headers: { host: 'attacker.example', 'content-type': 'application/json' } }, (res) => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject);
      req.end(JSON.stringify({ type: 'text', content: 'hello' }));
    });
    assert.equal(status, 403);
  });
});

test('URL validation blocks private, loopback, mapped, credentials and non-web addresses', () => {
  for (const url of ['http://localhost/', 'http://127.0.0.1/', 'http://10.1.2.3/', 'http://169.254.169.254/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://192.168.1.1/', 'http://user:pass@example.org/', 'file:///etc/passwd', 'http://example.org:8080/']) {
    assert.throws(() => parsePublicUrl(url), AppError, url);
  }
  for (const address of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '::1', '::ffff:8.8.8.8', 'fc00::1', 'fe80::1']) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
  assert.equal(parsePublicUrl('https://example.org/path').hostname, 'example.org');
});

test('DNS results and redirects cannot reach private addresses', async () => {
  await assert.rejects(() => resolvePublic('example.org', async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]), /public website/);
  const requests = [];
  await assert.rejects(() => extractArticle('https://example.org/', {
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async (url) => { requests.push(url.href); return { redirect: 'http://169.254.169.254/latest/meta-data' }; },
  }), /public website/);
  assert.deepEqual(requests, ['https://example.org/']);
});

test('client-rendered Breaking The News articles use the full article API safely', async () => {
  const calls = [];
  const extract = (payload, override = {}) => extractArticle('https://breakingthenews.net/Article/example/12345', {
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async (url, address, options) => {
      calls.push({ url: url.href, address, options });
      if (!options) return { type: 'text/html', body: '<html><body><div id="root"></div></body></html>' };
      return override.redirect ? { redirect: override.redirect } : { type: 'application/json', body: JSON.stringify(payload) };
    },
  });
  const payload = { NewsArticle: { '@id': '12345', Article: { '#cdata-section': '<p>First paragraph of the complete article.</p><p>Second paragraph provides further detail.</p><script>ignore me</script>' } } };
  assert.equal(await extract(payload), 'First paragraph of the complete article. Second paragraph provides further detail.');
  assert.equal(calls[1].url, 'https://breakingthenews.net/api/article');
  assert.deepEqual(calls[1].options, { method: 'POST', body: JSON.stringify({ NewsID: '12345' }), acceptedTypes: ['application/json'] });
  assert.deepEqual(calls[1].address, { address: '8.8.8.8', family: 4 });
  await assert.rejects(() => extract({ NewsArticle: { ...payload.NewsArticle, '@id': 'different' } }), /No readable article/);
  await assert.rejects(() => extract(payload, { redirect: 'http://169.254.169.254/' }), /No readable article/);
  let requests = 0;
  await assert.rejects(() => extractArticle('https://example.org/Article/example/12345', {
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async () => { requests++; return { type: 'text/html', body: '<div id="root"></div>' }; },
  }), /No readable article/);
  assert.equal(requests, 1);
});

test('Grok only accepts provider-cited sources for the specific claim and authentic excerpts', async () => {
  const text = 'The river rose last year. Everyone knows who is to blame.';
  let request;
  const result = {
    claims: [
      { excerpt: 'The river rose last year.', claim: 'The river rose', status: 'supported', explanation: 'A report confirms it.', sources: [{ title: 'Report', url: 'https://example.org/report' }, { title: 'Invented', url: 'https://example.org/not-real' }] },
      { excerpt: 'Everyone knows who is to blame.', claim: 'Blame', status: 'contradicted', explanation: 'A fabricated reason.', sources: [{ title: 'Invented', url: 'https://example.org/not-real' }] },
      { excerpt: 'Words never present', claim: 'Invalid', status: 'supported', explanation: 'Invalid', sources: [] },
    ],
    rhetoric: [{ category: 'Scapegoating', excerpt: 'Everyone knows who is to blame.', explanation: 'It implies shared blame.' }, { category: 'Invalid', excerpt: 'Never said', explanation: 'Invalid.' }],
    limitations: ['Evidence can change.'],
  };
  const fetchImpl = async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ citations: ['https://example.org/report'], output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] }) };
  };
  const actual = await analyzeWithGrok(text, { apiKey: 'test', fetchImpl });
  assert.deepEqual(request.tools, [{ type: 'web_search' }]);
  assert.equal(request.store, false);
  assert.equal(actual.claims.length, 2);
  assert.deepEqual(actual.claims[0].sources, [{ title: 'Report', url: 'https://example.org/report' }]);
  assert.equal(actual.claims[0].status, 'supported');
  assert.equal(actual.claims[1].status, 'unverified');
  assert.match(actual.claims[1].explanation, /No independently cited evidence/);
  assert.equal(actual.rhetoric.length, 1);
});

test('Grok missing credentials and upstream errors are safe', async () => {
  await assert.rejects(() => analyzeWithGrok('hello', { apiKey: '' }), /configure XAI_API_KEY/);
  await assert.rejects(() => analyzeWithGrok('hello', { apiKey: 'secret', fetchImpl: async () => ({ ok: false, status: 401 }) }), /credentials are invalid/);
  await assert.rejects(() => analyzeWithGrok('hello', { apiKey: 'secret', fetchImpl: async () => { throw new Error('secret'); } }), /could not be reached/);
});
