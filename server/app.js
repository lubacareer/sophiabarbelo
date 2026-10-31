import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import net from 'node:net';
import ipaddr from 'ipaddr.js';
import { extractArticle } from './article.js';
import { analyzeWithGrok } from './grok.js';
import { AppError } from './errors.js';

const MAX_TEXT = 30_000;
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT = 10;
const MAX_ANONYMOUS_IN_FLIGHT = 3;
const MAX_CLIENTS = 10_000;

function normalizeIp(value) {
  if (typeof value !== 'string' || !net.isIP(value)) return null;
  return ipaddr.process(value).toString();
}

function isLoopback(value) {
  const normalized = normalizeIp(value);
  return normalized !== null && ipaddr.parse(normalized).range() === 'loopback';
}

function sameSecret(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' || !expected) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function createApp({ extract = extractArticle, analyze = analyzeWithGrok, proxySecret = process.env.SOPHIA_PROXY_SECRET, now = Date.now } = {}) {
  const app = express();
  const clients = new Map();
  let anonymousInFlight = 0;
  app.disable('x-powered-by');
  // A loopback listener is reachable through a DNS rebinding attack unless it
  // also checks Host. Public deployments can explicitly add their hostnames.
  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', ...(process.env.ALLOWED_HOSTS || '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean)]);
  app.use('/api', (req, res, next) => {
    let host;
    try { host = new URL(`http://${req.headers.host}`).hostname.replace(/^\[|\]$/g, '').toLowerCase(); } catch { /* rejected below */ }
    if (!allowedHosts.has(host)) return res.status(403).json({ error: 'This host is not allowed.' });
    return next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.post('/api/analyze', async (req, res, next) => {
    let acquired = false;
    try {
      const { type, content } = req.body || {};
      if (!['text', 'url'].includes(type) || typeof content !== 'string' || !content.trim()) {
        throw new AppError(400, 'Enter text or a public article URL to analyze.');
      }
      const value = content.trim();
      if (value.length > (type === 'url' ? 2_048 : MAX_TEXT)) throw new AppError(400, type === 'url' ? 'The URL is too long.' : 'Text must be 30,000 characters or fewer.');

      // Only a loopback proxy presenting the shared secret can assert identity.
      // Direct clients' forwarded headers are never used for rate limiting.
      const authorization = req.get('Authorization') || '';
      const proxyCredential = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      const trustedProxy = isLoopback(req.socket.remoteAddress) && sameSecret(proxyCredential, proxySecret);
      const administrator = trustedProxy && req.get('X-Sophia-Admin') === '1';
      if (!administrator) {
        const client = trustedProxy ? normalizeIp(req.get('X-Sophia-Client-IP')) : normalizeIp(req.socket.remoteAddress);
        if (!client) throw new AppError(400, 'The client address could not be verified.');
        const time = now();
        let entry = clients.get(client);
        if (entry && time >= entry.resetAt) { clients.delete(client); entry = undefined; }
        if (entry && entry.count >= RATE_LIMIT) {
          res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - time) / 1000))));
          return res.status(429).json({ error: 'Too many analyses. Please try again later.' });
        }
        if (anonymousInFlight >= MAX_ANONYMOUS_IN_FLIGHT) {
          res.set('Retry-After', '10');
          return res.status(429).json({ error: 'The analyzer is busy. Please try again shortly.' });
        }
        if (!entry) {
          if (clients.size >= MAX_CLIENTS) {
            for (const [key, candidate] of clients) if (time >= candidate.resetAt) clients.delete(key);
          }
          if (clients.size >= MAX_CLIENTS) {
            res.set('Retry-After', '60');
            return res.status(429).json({ error: 'The analyzer is busy. Please try again shortly.' });
          }
          entry = { count: 0, resetAt: time + RATE_WINDOW_MS };
          clients.set(client, entry);
        }
        entry.count++;
        anonymousInFlight++;
        acquired = true;
      }
      const text = type === 'url' ? await extract(value) : value;
      res.set('Cache-Control', 'no-store').json(await analyze(text));
    } catch (error) { next(error); }
    finally { if (acquired) anonymousInFlight--; }
  });
  app.use((error, _req, res, _next) => {
    if (error instanceof AppError) return res.status(error.status).json({ error: error.message });
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'The submitted text is too large.' });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'The request could not be read.' });
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}
