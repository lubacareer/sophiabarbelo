import { performance } from 'node:perf_hooks';
import { AppError } from './errors.js';

export const REQUEST_WORK_TIMEOUT_MS = 280_000;

export function deadlineExceeded() {
  return new AppError(504, 'The analysis took too long. Please try again.');
}

// A signal stops asynchronous I/O; an absolute monotonic check also catches
// expiry while synchronous parsing has prevented the timer callback running.
export function createDeadline(timeoutMs, { parent, signal, now = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const controller = new AbortController();
  const duration = Math.max(0, Math.min(timeoutMs, parent?.remainingMs() ?? Infinity));
  const expiresAt = now() + duration;
  const inherited = [...new Set([parent?.signal, signal].filter(Boolean))];
  const listeners = [];
  const abort = (reason) => { if (!controller.signal.aborted) controller.abort(reason); };
  for (const source of inherited) {
    const onAbort = () => abort(source.reason);
    if (source.aborted) onAbort();
    else { source.addEventListener('abort', onAbort, { once: true }); listeners.push([source, onAbort]); }
  }
  const timer = setTimer(() => abort(deadlineExceeded()), duration);
  timer?.unref?.();
  return {
    signal: controller.signal,
    remainingMs() { return Math.max(0, Math.min(expiresAt - now(), parent?.remainingMs() ?? Infinity)); },
    check() {
      try {
        // Checking the parent first aborts every sibling on shared expiry.
        parent?.check();
        if (now() >= expiresAt) abort(deadlineExceeded());
        controller.signal.throwIfAborted();
      } catch (error) {
        // External signals can carry arbitrary private text, even in AppError.
        if (error instanceof AppError && error.status === 504) throw deadlineExceeded();
        throw error;
      }
    },
    dispose() {
      clearTimer(timer);
      for (const [source, listener] of listeners) source.removeEventListener('abort', listener);
    },
  };
}

export function checkDeadline(deadline, signal) {
  deadline?.check();
  signal?.throwIfAborted();
}

// DNS cannot be cancelled, and test transports may not observe AbortSignal.
// Observe both outcomes even after abort so late rejections remain handled.
export function awaitWithSignal(promise, signal) {
  if (!signal) return Promise.resolve(promise);
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => { cleanup(); reject(signal.reason); };
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => { cleanup(); resolve(value); },
      (error) => { cleanup(); reject(error); },
    );
  });
}
