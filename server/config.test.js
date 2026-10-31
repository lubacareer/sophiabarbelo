import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { apiProxyTarget } from '../vite.config.js';

test('example environment file starts with a comment, without a UTF-8 BOM', () => {
  assert.equal(readFileSync('.env.example')[0], '#'.charCodeAt(0));
});

test('example environment leaves reasoning effort unset', () => {
  const example = parseEnv(readFileSync('.env.example', 'utf8'));
  assert.equal(Object.hasOwn(example, 'XAI_REASONING_EFFORT'), false);
});

test('Vite proxy uses the API listener address, including wildcard and IPv6 hosts', () => {
  assert.equal(apiProxyTarget({}), 'http://127.0.0.1:3001');
  assert.equal(apiProxyTarget({ HOST: 'localhost', PORT: '3002' }), 'http://localhost:3002');
  assert.equal(apiProxyTarget({ HOST: '0.0.0.0', PORT: '3002' }), 'http://127.0.0.1:3002');
  assert.equal(apiProxyTarget({ HOST: '::', PORT: '3002' }), 'http://[::1]:3002');
  assert.equal(apiProxyTarget({ HOST: '::1', PORT: '3002' }), 'http://[::1]:3002');
});

test('Vite reads the same .env as the API, with process environment taking precedence', () => {
  const root = path.resolve(tmpdir());
  const temp = mkdtempSync(path.join(root, 'sophia-config-test-'));
  try {
    writeFileSync(path.join(temp, '.env'), 'HOST=127.0.0.1\nPORT=3002\n');
    const config = pathToFileURL(path.resolve('vite.config.js')).href;
    const script = `import(${JSON.stringify(config)}).then(m => console.log(m.apiProxyTarget()))`;
    const env = { ...process.env };
    delete env.HOST;
    delete env.PORT;
    const fromFile = spawnSync(process.execPath, ['-e', script], { cwd: temp, env, encoding: 'utf8' });
    assert.equal(fromFile.status, 0, fromFile.stderr);
    assert.equal(fromFile.stdout.trim(), 'http://127.0.0.1:3002');
    const fromProcess = spawnSync(process.execPath, ['-e', script], { cwd: temp, env: { ...env, PORT: '3003' }, encoding: 'utf8' });
    assert.equal(fromProcess.status, 0, fromProcess.stderr);
    assert.equal(fromProcess.stdout.trim(), 'http://127.0.0.1:3003');
  } finally {
    if (path.dirname(temp) === root) rmSync(temp, { recursive: true, force: true });
  }
});

test('the backend rejects public listeners whether or not proxy authentication is configured', () => {
  for (const secret of ['', 'example-only']) {
    const child = spawnSync(process.execPath, ['server/index.js'], {
      cwd: path.resolve('.'),
      env: { ...process.env, SOPHIA_PROXY_SECRET: secret, HOST: '0.0.0.0', PORT: '3001' },
      encoding: 'utf8', timeout: 5000,
    });
    assert.notEqual(child.status, 0);
    assert.match(child.stderr, /HOST must be a loopback address/);
  }
});
