import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import net from 'node:net';
import ipaddr from 'ipaddr.js';
import { extractArticle, parsePublicUrl } from './article.js';
import { analyzeConfigured, supportsReasoning } from './provider.js';
import { createSharedLimiter } from './shared-limiter.js';
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

function quotaKey(address) {
  const parsed = ipaddr.parse(address);
  if (parsed.kind() === 'ipv4') return `v4:${parsed.toString()}`;
  return `v6:${Buffer.from(parsed.toByteArray().slice(0, 8)).toString('hex')}`;
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

export function createApp({ extract = extractArticle, analyze = analyzeConfigured, proxySecret = process.env.SOPHIA_PROXY_SECRET, now = Date.now, deployment = 'local', sharedLimiter = createSharedLimiter() } = {}) {
  if (!['local', 'public', 'admin'].includes(deployment)) throw new Error('Invalid deployment mode');
  const app = express();
  const clients = new Map();
  let anonymousInFlight = 0;
  app.disable('x-powered-by');
  // A loopback listener is reachable through a DNS rebinding attack unless it
  // also checks Host. Public deployments can explicitly add their hostnames.
  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', ...(process.env.ALLOWED_HOSTS || '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean)]);
  app.use('/api', (req, res, next) => {
    // Vercel's gateway routes only domains assigned to this project. The
    // loopback DNS-rebinding guard remains in place for self-hosting.
    if (deployment !== 'local') return next();
    let host;
    try { host = new URL(`http://${req.headers.host}`).hostname.replace(/^\[|\]$/g, '').toLowerCase(); } catch { /* rejected below */ }
    if (!allowedHosts.has(host)) return res.status(403).json({ error: 'This host is not allowed.' });
    return next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.get('/api/config', (_req, res, next) => {
    try { res.set('Cache-Control', 'no-store').json({ reasoningControls: supportsReasoning() }); }
    catch (error) { next(error); }
  });
  app.post('/api/analyze', async (req, res, next) => {
    let acquired = false;
    let releaseLease;
    async function release() {
      if (!releaseLease) return;
      const releaseCurrent = releaseLease;
      releaseLease = null;
      // A lost store connection leaves the lease to expire; never release it
      // before the work has ended, even if the client disconnected.
      try { await releaseCurrent(); } catch { /* expiry handles cleanup */ }
    }
    try {
      const { type, content, reasoningEffort } = req.body || {};
      if (!['text', 'url'].includes(type) || typeof content !== 'string' || !content.trim()) {
        throw new AppError(400, 'Enter text or a public article URL to analyze.');
      }
      if (reasoningEffort !== undefined && !['low', 'medium', 'high'].includes(reasoningEffort)) {
        throw new AppError(400, 'Choose a valid reasoning setting.');
      }
      const value = content.trim();
      if (value.length > (type === 'url' ? 2_048 : MAX_TEXT)) throw new AppError(400, type === 'url' ? 'The URL is too long.' : 'Text must be 30,000 characters or fewer.');
      // Reject URLs that are invalid without network access before allocating quota.
      if (type === 'url') parsePublicUrl(value);

      if (deployment === 'public') {
        // Vercel overwrites X-Forwarded-For at its ingress. Never use the
        // self-hosted Caddy headers for a public serverless deployment.
        const client = normalizeIp(req.get('X-Forwarded-For'));
        if (!client) throw new AppError(400, 'The client address could not be verified.');
        releaseLease = await sharedLimiter.acquire(quotaKey(client));
      } else if (deployment === 'local') {
        // Only a loopback proxy presenting the shared secret can assert identity.
        const authorization = req.get('Authorization') || '';
        const proxyCredential = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
        const trustedProxy = isLoopback(req.socket.remoteAddress) && sameSecret(proxyCredential, proxySecret);
        const administrator = trustedProxy && req.get('X-Sophia-Admin') === '1';
        if (!administrator) {
          const client = trustedProxy ? normalizeIp(req.get('X-Sophia-Client-IP')) : normalizeIp(req.socket.remoteAddress);
          if (!client) throw new AppError(400, 'The client address could not be verified.');
          const key = quotaKey(client);
          const time = now();
          let entry = clients.get(key);
          if (entry && time >= entry.resetAt) { clients.delete(key); entry = undefined; }
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
            clients.set(key, entry);
          }
          entry.count++;
          anonymousInFlight++;
          acquired = true;
        }
      }
      const text = type === 'url' ? await extract(value) : value;
      const result = await analyze(text, { reasoningEffort });
      await release();
      res.set('Cache-Control', 'no-store').json(result);
    } catch (error) { await release(); next(error); }
    finally { if (acquired) anonymousInFlight--; }
  });
  app.use((error, _req, res, _next) => {
    if (error instanceof AppError) {
      if (Number.isSafeInteger(error.retryAfter) && error.retryAfter > 0) res.set('Retry-After', String(error.retryAfter));
      return res.status(error.status).json({ error: error.message });
    }
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'The submitted text is too large.' });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'The request could not be read.' });
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}
