import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import { isIP } from 'node:net';
import { loadEnvFile } from 'node:process';

// Match the API's --env-file-if-exists=.env behavior without exposing secrets.
if (existsSync('.env')) loadEnvFile('.env');

export function apiProxyTarget(env = process.env) {
  let host = (env.HOST || '127.0.0.1').replace(/^\[|\]$/g, '');
  if (host === '0.0.0.0') host = '127.0.0.1';
  if (host === '::') host = '::1';
  const authority = isIP(host) === 6 ? `[${host}]` : host;
  return `http://${authority}:${Number(env.PORT || 3001)}`;
}

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': apiProxyTarget() } },
});
