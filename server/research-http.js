import { AppError } from './errors.js';

export function incompleteResult() {
  return new AppError(502, 'The analysis service returned an incomplete result. Please try again.');
}

export function researchUnavailable() {
  return Object.assign(new AppError(503, 'Web research is temporarily unavailable. Please try again later.'), { providerResearchUnavailable: true });
}

function retryAfter(response) {
  const value = response.headers?.get?.('retry-after');
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const seconds = /^\d+(?:\.\d+)?$/.test(value.trim()) ? Math.ceil(Number(value)) : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined;
}

function withSignal(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

// Every request, including reading its JSON body, shares the analysis deadline.
// Only trusted, already localized application messages leave this boundary.
export async function requestJson(url, { headers, body, fetchImpl, signal, timeoutMs = 120_000, research = false }) {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)].filter(Boolean));
  let response;
  try {
    requestSignal.throwIfAborted();
    response = await withSignal(fetchImpl(url, { method: 'POST', redirect: 'error', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: requestSignal }), requestSignal);
  } catch { throw research ? researchUnavailable() : new AppError(502, 'The analysis service could not be reached. Please try again.'); }
  if (!response?.ok) {
    if ([401, 403].includes(response?.status)) throw new AppError(503, 'The analysis service credentials are invalid or do not have access.');
    if ([402, 429, 430, 432, 433, 434].includes(response?.status)) {
      const error = new AppError(response.status === 429 ? 429 : 503, 'The analysis service is busy or has reached its limit. Please try again later.');
      const seconds = retryAfter(response);
      if (seconds !== undefined) error.retryAfter = seconds;
      throw error;
    }
    if (response?.status === 413) throw new AppError(413, 'This text is too long for the analysis service. Please use a shorter text.');
    throw research ? researchUnavailable() : new AppError(502, 'The analysis service could not complete the request. Please try again.');
  }
  try {
    requestSignal.throwIfAborted();
    const payload = await withSignal(response.json(), requestSignal);
    requestSignal.throwIfAborted();
    return payload;
  } catch { throw research ? researchUnavailable() : incompleteResult(); }
}

export function parseModelJson(value) {
  try { return JSON.parse(value); } catch { throw incompleteResult(); }
}
