import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('Vercel runtime configuration enables the synchronous ESM imports needed by article extraction', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.equal(config.env.NODE_OPTIONS, '--experimental-require-module');
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    await import('./api/config.js');
    const { extractArticle } = await import('./server/article.js');
    const text = await extractArticle('https://example.org/article', {
      resolve: async () => [{ address: '8.8.8.8', family: 4 }],
      request: async () => ({ type: 'text/html', body: '<article><h1>Example article</h1><p>A readable article with enough content to exercise the HTML parser used by the deployed API.</p></article>' }),
    });
    console.log(text);
  `], {
    env: { ...process.env, ...config.env, VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'public' },
    encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /A readable article with enough content/);
});
