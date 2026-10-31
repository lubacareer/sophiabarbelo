import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from './errors.js';
import { ArticleConnectionError, extractArticle, isPublicAddress, parsePublicUrl } from './article.js';

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
