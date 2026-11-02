import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDeadline, awaitWithSignal, REQUEST_WORK_TIMEOUT_MS } from './deadline.js';
import { PUBLIC_LIMITS } from './shared-limiter.js';

test('the work and independent lease-release budgets fit below the configured function limit', () => {
  const maxDurationMs = JSON.parse(readFileSync('vercel.json', 'utf8')).functions['api/*.js'].maxDuration * 1000;
  assert.equal(maxDurationMs, 300_000);
  assert.ok(REQUEST_WORK_TIMEOUT_MS + 5_000 < maxDurationMs);
  assert.ok(PUBLIC_LIMITS.leaseMs > maxDurationMs);
});

test('research can use only the remaining request budget, including when the timer has not run', () => {
  let clock = 0;
  const timers = [];
  const cleared = [];
  const timing = { now: () => clock, setTimer: (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; }, clearTimer: (timer) => cleared.push(timer) };
  const parent = createDeadline(REQUEST_WORK_TIMEOUT_MS, timing);
  clock = 250_000;
  const research = createDeadline(240_000, { ...timing, parent });
  try {
    assert.equal(REQUEST_WORK_TIMEOUT_MS, 280_000);
    assert.deepEqual(timers.map(({ delay }) => delay), [280_000, 30_000]);
    assert.equal(research.remainingMs(), 30_000);
    clock = 279_999;
    research.check();
    assert.equal(research.remainingMs(), 1);
    clock = 280_000;
    assert.equal(parent.signal.aborted, false, 'The event loop has not run the timeout callback.');
    assert.throws(() => research.check(), (error) => error.status === 504 && error.message === 'The analysis took too long. Please try again.');
    assert.equal(parent.signal.aborted, true);
    assert.equal(research.signal.aborted, true);
  } finally { research.dispose(); parent.dispose(); }
  assert.deepEqual(cleared, [timers[1], timers[0]]);
});

test('a child keeps its shorter cap and parent cancellation reaches siblings', () => {
  const timers = [];
  const timing = { now: () => 0, setTimer: (callback, delay) => { timers.push({ callback, delay }); return timers.length; }, clearTimer: () => {} };
  const parent = createDeadline(280_000, timing);
  const first = createDeadline(240_000, { ...timing, parent });
  const second = createDeadline(120_000, { ...timing, parent });
  try {
    assert.equal(first.remainingMs(), 240_000);
    assert.equal(second.remainingMs(), 120_000);
    timers[0].callback();
    assert.throws(() => first.check(), (error) => error.status === 504);
    assert.throws(() => second.check(), (error) => error.status === 504);
  } finally { first.dispose(); second.dispose(); parent.dispose(); }
});

test('aborted waits observe late rejections without waiting for uncancellable DNS', async () => {
  const controller = new AbortController();
  let fail;
  const lookup = new Promise((_resolve, reject) => { fail = reject; });
  const waiting = awaitWithSignal(lookup, controller.signal);
  const rejected = assert.rejects(waiting, /cancelled/);
  controller.abort(new Error('cancelled'));
  await rejected;
  fail(new Error('late DNS failure'));
  await new Promise((resolve) => setImmediate(resolve));
});
