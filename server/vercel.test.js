import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

test('Vercel entrypoint fails closed without an explicit role and confirmed admin protection', async () => {
  const names = ['VERCEL', 'SOPHIA_DEPLOYMENT_ROLE', 'SOPHIA_ADMIN_PROTECTION_CONFIRMED'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const [index, values] of [
      { VERCEL: undefined, SOPHIA_DEPLOYMENT_ROLE: 'public' },
      { VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: undefined },
      { VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'invalid' },
      { VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'admin', SOPHIA_ADMIN_PROTECTION_CONFIRMED: undefined },
      { VERCEL: '1', SOPHIA_DEPLOYMENT_ROLE: 'admin', SOPHIA_ADMIN_PROTECTION_CONFIRMED: 'false' },
    ].entries()) {
      for (const name of names) {
        if (values[name] === undefined) delete process.env[name];
        else process.env[name] = values[name];
      }
      const { default: handler } = await import(`./vercel.js?configuration=${index}`);
      const headers = {};
      const response = { setHeader: (name, value) => { headers[name] = value; }, end: (body) => { response.body = body; } };
      handler({}, response);
      assert.equal(response.statusCode, 503);
      assert.equal(headers['Cache-Control'], 'no-store');
      assert.match(JSON.parse(response.body).error, /not safely configured/);
    }
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test('configured public Vercel API entrypoint serves the configuration route', async () => {
  const names = ['VERCEL', 'SOPHIA_DEPLOYMENT_ROLE'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.VERCEL = '1';
  process.env.SOPHIA_DEPLOYMENT_ROLE = 'public';
  const { default: handler } = await import('../api/config.js');
  const server = createServer(handler).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/config`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reasoningControls: false });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
