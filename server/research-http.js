import { AppError } from './errors.js';
import { awaitWithSignal, checkDeadline, deadlineExceeded } from './deadline.js';

const providerHosts = new Set(['generativelanguage.googleapis.com', 'api.cloudflare.com', 'api.tavily.com']);

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

function preserveDeadlineError(deadline) {
  try { deadline?.check(); }
  catch (error) { if (error instanceof AppError && error.status === 504) throw deadlineExceeded(); }
}

// Every request, including reading its JSON body, shares the analysis deadline.
// Only trusted, already localized application messages leave this boundary.
export async function requestJson(url, { headers, body, fetchImpl, signal, deadline, timeoutMs = 120_000, research = false, logger = console.warn }) {
  const requestSignal = AbortSignal.any([signal, deadline?.signal, AbortSignal.timeout(timeoutMs)].filter(Boolean));
  let response;
  try {
    checkDeadline(deadline, requestSignal);
    response = await awaitWithSignal(fetchImpl(url, { method: 'POST', redirect: 'error', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: requestSignal }), requestSignal);
    checkDeadline(deadline, requestSignal);
  } catch { preserveDeadlineError(deadline); throw research ? researchUnavailable() : new AppError(502, 'The analysis service could not be reached. Please try again.'); }
  if (!response?.ok) {
    // Never log the request URL, credentials, input, or provider response body.
    // Restrict diagnostics to known fixed API hosts and real HTTP status codes.
    try {
      const hostname = new URL(url).hostname;
      if (providerHosts.has(hostname) && Number.isInteger(response?.status) && response.status >= 100 && response.status <= 599 && typeof logger === 'function') {
        logger('Analysis provider returned an error.', { provider: hostname, status: response.status });
      }
    } catch { /* Diagnostics must never replace the safe application error. */ }
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
    checkDeadline(deadline, requestSignal);
    const payload = await awaitWithSignal(response.json(), requestSignal);
    checkDeadline(deadline, requestSignal);
    return payload;
  } catch { preserveDeadlineError(deadline); throw research ? researchUnavailable() : incompleteResult(); }
}

export function parseModelJson(value) {
  try { return JSON.parse(value); } catch { throw incompleteResult(); }
}
