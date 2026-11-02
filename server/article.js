import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import ipaddr from 'ipaddr.js';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { AppError } from './errors.js';
import { awaitWithSignal, checkDeadline } from './deadline.js';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 30_000;
const TIMEOUT = 10_000;
const MAX_ADDRESSES = 3;
const RETRYABLE_CONNECTION_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH',
  'EADDRNOTAVAIL', 'ENETDOWN', 'EHOSTDOWN',
]);

// Kept distinct from response and content errors so only failures to connect
// to a particular vetted address can trigger a retry.
export class ArticleConnectionError extends AppError {
  constructor() {
    super(422, 'The article could not be accessed. Try pasting its text instead.');
  }
}

export function isPublicAddress(address) {
  if (!ipaddr.isValid(address)) return false;
  let parsed = ipaddr.parse(address);
  if (parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress()) return false;
  return parsed.range() === 'unicast';
}

export function parsePublicUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new AppError(400, 'Enter a valid public HTTP or HTTPS URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')))) {
    throw new AppError(400, 'Only public HTTP or HTTPS URLs on standard ports are supported.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') ||
      (net.isIP(hostname) && !isPublicAddress(hostname))) {
    throw new AppError(400, 'The URL must point to a public website.');
  }
  return url;
}

export async function resolvePublic(hostname, lookup = dns.lookup, { deadline, signal = deadline?.signal } = {}) {
  checkDeadline(deadline, signal);
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (!isPublicAddress(host)) throw new AppError(400, 'The URL must point to a public website.');
    return [{ address: host, family: net.isIP(host) }];
  }
  let timer;
  try {
    const pending = Promise.race([
      lookup(host, { all: true, verbatim: true }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS timeout')), TIMEOUT); }),
    ]);
    const answers = await awaitWithSignal(pending, signal);
    checkDeadline(deadline, signal);
    if (!answers.length || answers.some(({ address }) => !isPublicAddress(address))) {
      throw new AppError(400, 'The URL must point to a public website.');
    }
    return answers;
  } catch (error) {
    checkDeadline(deadline, signal);
    if (error instanceof AppError) throw error;
    throw new AppError(422, 'The website address could not be resolved.');
  } finally { clearTimeout(timer); }
}

function requestPinned(url, address, { method = 'GET', body, acceptedTypes = ['text/html', 'application/xhtml+xml', 'text/plain'], deadline, signal = deadline?.signal } = {}) {
  return new Promise((resolve, reject) => {
    checkDeadline(deadline, signal);
    const transport = url.protocol === 'https:' ? https : http;
    let timer;
    let responseReceived = false;
    let response;
    let settled = false;
    let failure;
    let earlyResult;
    function cancellationError() {
      try { checkDeadline(deadline, signal); } catch (error) { return error; }
    }
    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
    function finish(error, result) {
      if (settled) return;
      settled = true;
      cleanup();
      const reason = cancellationError() || error;
      if (reason) reject(reason);
      else resolve(result);
    }
    function stop(error, result) {
      if (settled) return;
      failure ||= error;
      if (result) earlyResult = result;
      // Wait for the request's close event before exposing cancellation or an
      // early response. A redirect/error body must not keep streaming behind it.
      response?.destroy();
      req.destroy();
    }
    function abort() { stop(cancellationError() || signal.reason); }
    const req = transport.request(url, {
      method,
      headers: {
        'user-agent': 'SophiasMirror/1.0',
        accept: acceptedTypes.join(','),
        'accept-encoding': 'identity',
        ...(body === undefined ? {} : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }),
      },
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      },
      // Avoid pooling a socket opened for an earlier, differently pinned request.
      agent: false,
      autoSelectFamily: false,
      timeout: TIMEOUT,
    }, (res) => {
      responseReceived = true;
      response = res;
      res.on('error', () => {
        if (!failure && !earlyResult) stop(new AppError(422, 'The article could not be read.'));
      });
      const cancelled = cancellationError();
      if (cancelled) { stop(cancelled); return; }
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        stop(undefined, { redirect: res.headers.location }); return;
      }
      if (status < 200 || status >= 300) { stop(new AppError(422, 'The article could not be accessed. Try pasting its text instead.')); return; }
      const type = (res.headers['content-type'] || '').toLowerCase();
      if (!acceptedTypes.some((accepted) => type.split(';', 1)[0].trim() === accepted)) {
        stop(new AppError(422, 'The URL must point to an HTML or plain-text article.')); return;
      }
      if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') {
        stop(new AppError(422, 'The website returned an unsupported response. Try pasting its text instead.')); return;
      }
      if (Number(res.headers['content-length']) > MAX_BYTES) {
        stop(new AppError(422, 'The article is too large to process.')); return;
      }
      let size = 0;
      const chunks = [];
      res.on('data', (chunk) => {
        const cancelled = cancellationError();
        if (cancelled) { stop(cancelled); return; }
        size += chunk.length;
        if (size > MAX_BYTES) stop(new AppError(422, 'The article is too large to process.'));
        else chunks.push(chunk);
      });
      res.on('end', () => finish(failure, { body: Buffer.concat(chunks).toString('utf8'), type }));
    });
    const timeoutError = () => responseReceived ? new AppError(422, 'The article could not be accessed. Try pasting its text instead.') : new ArticleConnectionError();
    req.on('timeout', () => stop(cancellationError() || timeoutError()));
    req.on('error', (error) => {
      if (failure || earlyResult) return;
      failure = cancellationError() || (!responseReceived && RETRYABLE_CONNECTION_CODES.has(error.code) ? new ArticleConnectionError() : new AppError(422, 'The article could not be accessed. Try pasting its text instead.'));
    });
    // Socket idle timeouts alone can be defeated by a slow response. Bound the
    // complete response even if the remote peer keeps sending small chunks.
    timer = setTimeout(() => stop(cancellationError() || timeoutError()), Math.max(1, Math.min(TIMEOUT, deadline?.remainingMs() ?? TIMEOUT)));
    req.on('close', () => {
      finish(failure || (!earlyResult && new AppError(422, 'The article could not be accessed. Try pasting its text instead.')), earlyResult);
      cleanup();
    });
    signal?.addEventListener('abort', abort, { once: true });
    const cancelled = cancellationError();
    if (cancelled) { stop(cancelled); return; }
    req.end(body);
  });
}

async function requestWithFallback(url, addresses, request, options) {
  const { signal, deadline } = options || {};
  let lastError;
  for (const address of addresses.slice(0, MAX_ADDRESSES)) {
    checkDeadline(deadline, signal);
    try {
      const response = await request(url, address, options);
      checkDeadline(deadline, signal);
      return response;
    }
    catch (error) {
      checkDeadline(deadline, signal);
      if (!(error instanceof ArticleConnectionError)) throw error;
      lastError = error;
    }
  }
  throw lastError || new AppError(422, 'The article could not be accessed. Try pasting its text instead.');
}

async function resolveAddresses(hostname, resolve, options) {
  const { signal, deadline } = options || {};
  checkDeadline(deadline, signal);
  const pending = resolve === resolvePublic ? resolve(hostname, undefined, options) : resolve(hostname, options);
  try {
    const addresses = await awaitWithSignal(pending, signal);
    checkDeadline(deadline, signal);
    return addresses;
  } catch (error) {
    checkDeadline(deadline, signal);
    throw error;
  }
}

// Breaking The News serves an empty HTML shell and loads the full article from
// its own JSON endpoint. Restrict the adapter to article IDs and the same host.
async function extractBreakingNews(url, resolve, request, options) {
  const { signal, deadline } = options || {};
  checkDeadline(deadline, signal);
  if (!['breakingthenews.net', 'www.breakingthenews.net'].includes(url.hostname.toLowerCase())) return '';
  const match = url.pathname.match(/^\/Article\/[^/]+\/(\d+)\/?$/i);
  if (!match) return '';
  const apiUrl = parsePublicUrl(new URL('/api/article', url).href);
  const addresses = await resolveAddresses(apiUrl.hostname, resolve, options);
  const response = await requestWithFallback(apiUrl, addresses, request, {
    ...options,
    method: 'POST', body: JSON.stringify({ NewsID: match[1] }), acceptedTypes: ['application/json'],
  });
  // Do not forward the POST body to a redirect destination.
  if ('redirect' in response) return '';
  let article;
  try { article = JSON.parse(response.body)?.NewsArticle; } catch { return ''; }
  if (String(article?.['@id']) !== match[1] || typeof article?.Article?.['#cdata-section'] !== 'string') return '';
  checkDeadline(deadline, signal);
  const dom = new JSDOM(article.Article['#cdata-section']);
  try {
    checkDeadline(deadline, signal);
    dom.window.document.querySelectorAll('script, style, noscript').forEach((element) => element.remove());
    dom.window.document.querySelectorAll('p, div, li, br, h1, h2, h3, h4, h5, h6').forEach((element) => {
      element.after(dom.window.document.createTextNode(' '));
    });
    const text = dom.window.document.body.textContent || '';
    checkDeadline(deadline, signal);
    return text;
  } finally { dom.window.close(); }
}

export async function extractArticle(value, { resolve = resolvePublic, request = requestPinned, deadline, signal = deadline?.signal } = {}) {
  const options = signal || deadline ? { ...(signal ? { signal } : {}), ...(deadline ? { deadline } : {}) } : undefined;
  checkDeadline(deadline, signal);
  let url = parsePublicUrl(value);
  for (let redirects = 0; redirects <= 3; redirects++) {
    checkDeadline(deadline, signal);
    const addresses = await resolveAddresses(url.hostname, resolve, options);
    const response = await requestWithFallback(url, addresses, request, options);
    if ('redirect' in response) {
      if (!response.redirect || redirects === 3) throw new AppError(422, 'The website redirected too many times or to an invalid address.');
      try { url = parsePublicUrl(new URL(response.redirect, url).href); }
      catch (error) { if (error instanceof AppError) throw error; throw new AppError(422, 'The website redirected to an invalid address.'); }
      continue;
    }
    let text;
    if (response.type.startsWith('text/plain')) text = response.body;
    else {
      checkDeadline(deadline, signal);
      const dom = new JSDOM(response.body, { url: url.href });
      try {
        checkDeadline(deadline, signal);
        const article = new Readability(dom.window.document).parse();
        text = article?.textContent || '';
        checkDeadline(deadline, signal);
      } finally { dom.window.close(); }
      if (text.replace(/\s+/g, ' ').trim().length < 40) {
        text = await extractBreakingNews(url, resolve, request, options);
      }
    }
    text = text.replace(/\s+/g, ' ').trim();
    checkDeadline(deadline, signal);
    if (text.length < 40) throw new AppError(422, 'No readable article text was found. Try pasting the text instead.');
    if (text.length > MAX_TEXT) throw new AppError(422, `The article is too long. Please paste up to ${MAX_TEXT.toLocaleString()} characters.`);
    return text;
  }
}
