import { AppError } from './errors.js';
import { awaitWithSignal, checkDeadline, deadlineExceeded } from './deadline.js';
import { performance } from 'node:perf_hooks';

const providerHosts = new Set(['generativelanguage.googleapis.com', 'api.cloudflare.com', 'api.tavily.com']);
const stages = new Set(['query', 'analysis']);
const transportCodes = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID']);

function warnRequestFailure(url, { logger, stage, phase, timeoutSignal, requestSignal, startedAt }, error) {
  try {
    const provider = new URL(url).hostname;
    if (!providerHosts.has(provider) || typeof logger !== 'function') return;
    const code = error?.cause?.code ?? error?.code;
    logger('Analysis provider request failed.', {
      provider, ...(stages.has(stage) ? { stage } : {}), phase,
      failure: timeoutSignal.aborted ? 'timeout' : requestSignal.aborted ? 'cancelled' : 'transport',
      elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ...(transportCodes.has(code) ? { code } : {}),
    });
  } catch { /* Diagnostics never replace the safe application error. */ }
}

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
export async function requestJson(url, { headers, body, fetchImpl, signal, deadline, timeoutMs = 120_000, research = false, logger = console.warn, stage }) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const requestSignal = AbortSignal.any([signal, deadline?.signal, timeoutSignal].filter(Boolean));
  const startedAt = performance.now();
  let response;
  try {
    checkDeadline(deadline, requestSignal);
    response = await awaitWithSignal(fetchImpl(url, { method: 'POST', redirect: 'error', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: requestSignal }), requestSignal);
    checkDeadline(deadline, requestSignal);
  } catch (error) {
    warnRequestFailure(url, { logger, stage, phase: 'fetch', timeoutSignal, requestSignal, startedAt }, error);
    preserveDeadlineError(deadline);
    if (timeoutSignal.aborted && !research) throw deadlineExceeded();
    throw research ? researchUnavailable() : new AppError(502, 'The analysis service could not be reached. Please try again.');
  }
  if (!response?.ok) {
    // Never log the request URL, credentials, input, or provider response body.
    // Restrict diagnostics to known fixed API hosts and real HTTP status codes.
    try {
      const hostname = new URL(url).hostname;
      if (providerHosts.has(hostname) && Number.isInteger(response?.status) && response.status >= 100 && response.status <= 599 && typeof logger === 'function') {
        logger('Analysis provider returned an error.', { provider: hostname, status: response.status, ...(stages.has(stage) ? { stage } : {}) });
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
  } catch (error) {
    warnRequestFailure(url, { logger, stage, phase: 'body', timeoutSignal, requestSignal, startedAt }, error);
    preserveDeadlineError(deadline);
    if (timeoutSignal.aborted && !research) throw deadlineExceeded();
    throw research ? researchUnavailable() : incompleteResult();
  }
}

export function parseModelJson(value) {
  try { return JSON.parse(value); } catch { throw incompleteResult(); }
}
