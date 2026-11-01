import { createApp } from './app.js';
import { localize, requestLanguage } from './localization.js';

// The role is fixed by the deployment configuration, never by a request header.
// Vercel Authentication must protect the entire administrator deployment.
const role = process.env.SOPHIA_DEPLOYMENT_ROLE;
const configured = process.env.VERCEL === '1' && ['public', 'admin'].includes(role)
  && (role !== 'admin' || process.env.SOPHIA_ADMIN_PROTECTION_CONFIRMED === 'true');
const app = configured ? createApp({ deployment: role }) : null;

export default function vercelHandler(req, res) {
  if (!app) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: localize('This deployment is not safely configured.', requestLanguage(req)) }));
    return;
  }
  return app(req, res);
}
