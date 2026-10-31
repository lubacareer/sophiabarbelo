import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import ipaddr from 'ipaddr.js';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { AppError } from './errors.js';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 30_000;
const TIMEOUT = 10_000;

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

export async function resolvePublic(hostname, lookup = dns.lookup) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (!isPublicAddress(host)) throw new AppError(400, 'The URL must point to a public website.');
    return [{ address: host, family: net.isIP(host) }];
  }
  let timer;
  try {
    const answers = await Promise.race([
      lookup(host, { all: true, verbatim: true }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS timeout')), TIMEOUT); }),
    ]);
    if (!answers.length || answers.some(({ address }) => !isPublicAddress(address))) {
      throw new AppError(400, 'The URL must point to a public website.');
    }
    return answers;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(422, 'The website address could not be resolved.');
  } finally { clearTimeout(timer); }
}

function requestPinned(url, address) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    let timer;
    const req = transport.request(url, {
      method: 'GET',
      headers: { 'user-agent': 'SophiasMirror/1.0', accept: 'text/html,application/xhtml+xml,text/plain', 'accept-encoding': 'identity' },
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      },
      autoSelectFamily: false,
      timeout: TIMEOUT,
    }, (res) => {
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        res.resume();
        return resolve({ redirect: res.headers.location });
      }
      if (status < 200 || status >= 300) { res.resume(); return reject(new AppError(422, 'The article could not be accessed. Try pasting its text instead.')); }
      const type = (res.headers['content-type'] || '').toLowerCase();
      if (!type.startsWith('text/html') && !type.startsWith('application/xhtml+xml') && !type.startsWith('text/plain')) {
        res.resume(); return reject(new AppError(422, 'The URL must point to an HTML or plain-text article.'));
      }
      if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') {
        res.resume(); return reject(new AppError(422, 'The website returned an unsupported response. Try pasting its text instead.'));
      }
      if (Number(res.headers['content-length']) > MAX_BYTES) {
        res.resume(); return reject(new AppError(422, 'The article is too large to process.'));
      }
      let size = 0;
      const chunks = [];
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BYTES) { res.destroy(); reject(new AppError(422, 'The article is too large to process.')); }
        else chunks.push(chunk);
      });
      res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8'), type }));
      res.on('error', () => reject(new AppError(422, 'The article could not be read.')));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', () => reject(new AppError(422, 'The article could not be accessed. Try pasting its text instead.')));
    // Socket idle timeouts alone can be defeated by a slow response. Bound the
    // complete response even if the remote peer keeps sending small chunks.
    timer = setTimeout(() => req.destroy(new Error('deadline exceeded')), TIMEOUT);
    req.on('close', () => clearTimeout(timer));
    req.end();
  });
}

export async function extractArticle(value, { resolve = resolvePublic, request = requestPinned } = {}) {
  let url = parsePublicUrl(value);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const addresses = await resolve(url.hostname);
    const response = await request(url, addresses[0]);
    if ('redirect' in response) {
      if (!response.redirect || redirects === 3) throw new AppError(422, 'The website redirected too many times or to an invalid address.');
      try { url = parsePublicUrl(new URL(response.redirect, url).href); }
      catch (error) { if (error instanceof AppError) throw error; throw new AppError(422, 'The website redirected to an invalid address.'); }
      continue;
    }
    let text;
    if (response.type.startsWith('text/plain')) text = response.body;
    else {
      const dom = new JSDOM(response.body, { url: url.href });
      const article = new Readability(dom.window.document).parse();
      text = article?.textContent || '';
      dom.window.close();
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length < 40) throw new AppError(422, 'No readable article text was found. Try pasting the text instead.');
    if (text.length > MAX_TEXT) throw new AppError(422, `The article is too long. Please paste up to ${MAX_TEXT.toLocaleString()} characters.`);
    return text;
  }
}
