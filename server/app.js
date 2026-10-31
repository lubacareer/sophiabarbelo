import express from 'express';
import { extractArticle } from './article.js';
import { analyzeWithGrok } from './grok.js';
import { AppError } from './errors.js';

const MAX_TEXT = 30_000;

export function createApp({ extract = extractArticle, analyze = analyzeWithGrok } = {}) {
  const app = express();
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
  app.use(express.json({ limit: '64kb' }));
  app.post('/api/analyze', async (req, res, next) => {
    try {
      const { type, content } = req.body || {};
      if (!['text', 'url'].includes(type) || typeof content !== 'string' || !content.trim()) {
        throw new AppError(400, 'Enter text or a public article URL to analyze.');
      }
      const value = content.trim();
      if (value.length > (type === 'url' ? 2_048 : MAX_TEXT)) throw new AppError(400, type === 'url' ? 'The URL is too long.' : 'Text must be 30,000 characters or fewer.');
      const text = type === 'url' ? await extract(value) : value;
      res.set('Cache-Control', 'no-store').json(await analyze(text));
    } catch (error) { next(error); }
  });
  app.use((error, _req, res, _next) => {
    if (error instanceof AppError) return res.status(error.status).json({ error: error.message });
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'The submitted text is too large.' });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'The request could not be read.' });
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}
