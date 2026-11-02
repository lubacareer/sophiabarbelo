import test from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import http from 'node:http';
import { Readability } from '@mozilla/readability';
import { AppError } from './errors.js';
import { ArticleConnectionError, extractArticle, isPublicAddress, parsePublicUrl, resolvePublic } from './article.js';
import { createDeadline } from './deadline.js';

const addresses = [
  { address: '2606:4700:4700::1111', family: 6 },
  { address: '8.8.8.8', family: 4 },
  { address: '1.1.1.1', family: 4 },
  { address: '8.8.4.4', family: 4 },
];
const articleText = 'A public article with enough readable text to be analyzed.';

test('address classification covers private and public range boundaries', () => {
  for (const address of [
    '0.0.0.0', '10.0.0.0', '10.255.255.255', '100.64.0.1', '127.0.0.1',
    '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.255.255',
    '224.0.0.1', '255.255.255.255', '::1', '::ffff:8.8.8.8',
    'fc00::1', 'fdff::1', 'fe80::1', 'febf::1', 'fec0::1',
  ]) assert.equal(isPublicAddress(address), false, address);
  for (const address of ['172.15.255.255', '172.32.0.1', 'fbff::1', 'fe00::1', 'fe7f::1']) {
    assert.equal(isPublicAddress(address), true, address);
  }
  for (const url of ['http://[fe80::1]/', 'http://[febf::1]/']) {
    assert.throws(() => parsePublicUrl(url), AppError, url);
  }
});

test('retries failed connections with up to three resolved addresses', async () => {
  const calls = [];
  const text = await extractArticle('https://example.org/article', {
    resolve: async () => addresses,
    request: async (_url, address) => {
      calls.push(address);
      if (calls.length < 3) throw new ArticleConnectionError();
      return { type: 'text/plain', body: articleText };
    },
  });
  assert.equal(text, articleText);
  assert.deepEqual(calls, addresses.slice(0, 3));

  const finalError = new ArticleConnectionError();
  const attempts = [];
  await assert.rejects(() => extractArticle('https://example.org/article', {
    resolve: async () => addresses,
    request: async (_url, address) => { attempts.push(address); throw finalError; },
  }), (error) => error === finalError);
  assert.deepEqual(attempts, addresses.slice(0, 3));
});

test('does not retry response, content, or certificate-style errors', async () => {
  for (const error of [
    new AppError(422, 'The article could not be accessed. Try pasting its text instead.'),
    new AppError(422, 'The article is too large to process.'),
    new Error('certificate validation failed'),
  ]) {
    let attempts = 0;
    await assert.rejects(() => extractArticle('https://example.org/article', {
      resolve: async () => addresses,
      request: async () => { attempts++; throw error; },
    }), (actual) => actual === error);
    assert.equal(attempts, 1);
  }
});

test('Breaking The News API retries connection failures using the same vetted addresses and POST', async () => {
  const calls = [];
  const text = await extractArticle('https://breakingthenews.net/Article/example/12345', {
    resolve: async () => addresses,
    request: async (url, address, options) => {
      calls.push({ url: url.href, address, options });
      if (!options) return { type: 'text/html', body: '<html><body><div id="root"></div></body></html>' };
      if (address === addresses[0]) throw new ArticleConnectionError();
      return { type: 'application/json', body: JSON.stringify({ NewsArticle: { '@id': '12345', Article: { '#cdata-section': `<p>${articleText}</p>` } } }) };
    },
  });
  assert.equal(text, articleText);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].url, 'https://breakingthenews.net/api/article');
  assert.deepEqual(calls[1].address, addresses[0]);
  assert.deepEqual(calls[2].address, addresses[1]);
  assert.deepEqual(calls[1].options, calls[2].options);
  assert.equal(calls[2].options.method, 'POST');
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('already-cancelled extraction and direct DNS calls start no work', async () => {
  const controller = new AbortController();
  const reason = new AppError(504, 'The analysis took too long. Please try again.');
  controller.abort(reason);
  await assert.rejects(() => extractArticle('https://example.org/article', {
    signal: controller.signal,
    resolve: async () => { assert.fail('Cancelled extraction must not resolve a host'); },
    request: async () => { assert.fail('Cancelled extraction must not request an article'); },
  }), (error) => error === reason);
  await assert.rejects(() => resolvePublic('example.org', async () => { assert.fail('Cancelled DNS must not start'); }, { signal: controller.signal }), (error) => error === reason);
});

test('default DNS lookup remains injectable and late DNS outcomes cannot restart cancelled extraction', async (t) => {
  for (const outcome of ['success', 'failure']) {
    const controller = new AbortController();
    const lookupStarted = deferred();
    const lookupResult = deferred();
    let requests = 0;
    const lookup = t.mock.method(dns, 'lookup', async (host, options) => {
      assert.equal(host, 'example.org');
      assert.deepEqual(options, { all: true, verbatim: true });
      lookupStarted.resolve();
      return lookupResult.promise;
    });
    const work = extractArticle('https://example.org/article', { signal: controller.signal, request: async () => { requests++; return { type: 'text/plain', body: articleText }; } });
    await lookupStarted.promise;
    const reason = new AppError(504, 'The analysis took too long. Please try again.');
    const rejected = assert.rejects(work, (error) => error === reason);
    controller.abort(reason);
    await rejected;
    if (outcome === 'success') lookupResult.resolve(addresses);
    else lookupResult.reject(new Error('Late DNS failure must remain handled'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(requests, 0);
    lookup.mock.restore();
  }
  assert.deepEqual(await resolvePublic('example.org', async () => addresses), addresses, 'The existing second lookup argument remains supported.');
});

test('injected resolver waits are cancelled and cancellation is not retried as an address connection failure', async () => {
  const controller = new AbortController();
  const reason = new AppError(504, 'The analysis took too long. Please try again.');
  let attempts = 0;
  await assert.rejects(() => extractArticle('https://example.org/article', {
    signal: controller.signal,
    resolve: async (_host, options) => { assert.equal(options.signal, controller.signal); return addresses; },
    request: async (_url, _address, options) => {
      attempts++;
      assert.equal(options.signal, controller.signal);
      controller.abort(reason);
      throw new ArticleConnectionError();
    },
  }), (error) => error === reason);
  assert.equal(attempts, 1);

  const another = new AbortController();
  const started = deferred();
  const late = deferred();
  const work = extractArticle('https://example.org/article', { signal: another.signal, resolve: async () => { started.resolve(); return late.promise; }, request: async () => { assert.fail('Late injected DNS must not start HTTP'); } });
  await started.promise;
  const rejected = assert.rejects(work, (error) => error === reason);
  another.abort(reason);
  await rejected;
  late.resolve(addresses);
});

test('every redirect shares the absolute deadline rather than restarting the extraction budget', async () => {
  let clock = 0;
  const deadline = createDeadline(100, { now: () => clock, setTimer: () => null, clearTimer: () => {} });
  let requests = 0;
  let resolutions = 0;
  try {
    await assert.rejects(() => extractArticle('https://example.org/start', {
      deadline,
      resolve: async (_host, options) => { resolutions++; assert.equal(options.deadline, deadline); assert.equal(options.signal, deadline.signal); return addresses; },
      request: async (_url, _address, options) => {
        assert.equal(options.deadline, deadline);
        assert.equal(options.signal, deadline.signal);
        requests++;
        clock += 40;
        return { redirect: `https://example.org/hop-${requests}` };
      },
    }), (error) => error.status === 504);
    assert.equal(requests, 3);
    assert.equal(resolutions, 3);
  } finally { deadline.dispose(); }
});

test('absolute expiry after synchronous article parsing closes its DOM and prevents a successful result', async (t) => {
  let clock = 0;
  let closed = false;
  const deadline = createDeadline(100, { now: () => clock, setTimer: () => null, clearTimer: () => {} });
  t.mock.method(Readability.prototype, 'parse', function () {
    const window = this._doc.defaultView;
    const close = window.close.bind(window);
    t.mock.method(window, 'close', () => { closed = true; close(); });
    clock = 100;
    return { textContent: articleText };
  });
  try {
    await assert.rejects(() => extractArticle('https://example.org/article', { deadline, resolve: async () => addresses, request: async () => ({ type: 'text/html', body: `<article><p>${articleText}</p></article>` }) }), (error) => error.status === 504);
    assert.equal(closed, true);
  } finally { deadline.dispose(); }
});

test('Breaking The News cancellation during its second DNS wait prevents the JSON POST', async () => {
  const controller = new AbortController();
  const reason = new AppError(504, 'The analysis took too long. Please try again.');
  let resolutions = 0;
  let requests = 0;
  await assert.rejects(() => extractArticle('https://breakingthenews.net/Article/example/12345', {
    signal: controller.signal,
    resolve: async (_host, options) => {
      assert.equal(options.signal, controller.signal);
      if (++resolutions === 2) controller.abort(reason);
      return addresses;
    },
    request: async (_url, _address, options) => {
      assert.equal(options.signal, controller.signal);
      requests++;
      assert.equal(options.method, undefined);
      return { type: 'text/html', body: '<html><body><div id="root"></div></body></html>' };
    },
  }), (error) => error === reason);
  assert.equal(resolutions, 2);
  assert.equal(requests, 1);
});

test('injected article requests retain their cancellation cleanup before extraction settles', async () => {
  const controller = new AbortController();
  const reason = new AppError(504, 'The analysis took too long. Please try again.');
  const started = deferred();
  const cleanup = deferred();
  let settled = false;
  const work = extractArticle('https://example.org/article', { signal: controller.signal, resolve: async () => addresses, request: async (_url, _address, options) => {
    assert.equal(options.signal, controller.signal);
    started.resolve();
    await cleanup.promise;
    return { type: 'text/plain', body: articleText };
  } }).finally(() => { settled = true; });
  await started.promise;
  controller.abort(reason);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false, 'An injected request must finish its cleanup before the caller can release capacity.');
  const rejected = assert.rejects(work, (error) => error === reason);
  cleanup.resolve();
  await rejected;
});

async function withLocalTransport(t, handler, run) {
  const server = http.createServer(handler).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const nativeRequest = http.request.bind(http);
  const requests = [];
  const responses = [];
  const firstData = deferred();
  const transport = t.mock.method(http, 'request', (url, options, callback) => {
    // Only this test transport routes the fixed public fixture to loopback.
    // Production URL validation and DNS pinning remain unchanged.
    const target = new URL(url);
    target.hostname = '127.0.0.1';
    target.port = String(server.address().port);
    const request = nativeRequest(target, { ...options, lookup: undefined }, callback);
    requests.push(request);
    request.on('response', (response) => {
      responses.push(response);
      response.once('data', () => firstData.resolve());
    });
    return request;
  });
  try { await run({ requests, responses, firstData: firstData.promise }); }
  finally {
    for (const request of requests) request.destroy();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    transport.mock.restore();
  }
}

test('native cancellation destroys a stalled response and settles after its request closes without fallback', { timeout: 3000 }, async (t) => {
  await withLocalTransport(t, (_request, response) => { response.writeHead(200, { 'content-type': 'text/plain' }); response.write(articleText); }, async ({ requests, responses, firstData }) => {
    const controller = new AbortController();
    const reason = new AppError(504, 'The analysis took too long. Please try again.');
    let closed = false;
    const work = extractArticle('http://example.org/article', { signal: controller.signal, resolve: async () => addresses });
    await firstData;
    requests[0].once('close', () => { closed = true; });
    const rejected = assert.rejects(work, (error) => error === reason);
    controller.abort(reason);
    await rejected;
    assert.equal(requests.length, 1);
    assert.equal(requests[0].destroyed, true);
    assert.equal(responses[0].destroyed, true);
    assert.equal(closed, true);
  });
});

test('native redirect bodies are destroyed before the next pinned request starts', { timeout: 3000 }, async (t) => {
  await withLocalTransport(t, (request, response) => {
    if (request.url === '/article') { response.writeHead(302, { location: 'http://example.org/next' }); response.write('This redirect body never ends.'); }
    else { response.writeHead(200, { 'content-type': 'text/plain' }); response.end(articleText); }
  }, async ({ requests, responses }) => {
    const text = await extractArticle('http://example.org/article', { resolve: async () => addresses });
    assert.equal(text, articleText);
    assert.equal(requests.length, 2);
    assert.equal(responses[0].destroyed, true);
    assert.equal(requests[0].destroyed, true);
  });
});
