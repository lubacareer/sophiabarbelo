import { parsePublicUrl } from './article.js';
import { incompleteResult, requestJson, researchUnavailable } from './research-http.js';
import { AppError } from './errors.js';
import { checkDeadline, deadlineExceeded } from './deadline.js';

function sourceUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u001f\u007f]/u.test(value)) return null;
  try {
    const url = parsePublicUrl(value);
    url.hash = '';
    return url.href;
  } catch { return null; }
}

export async function searchWithTavily(query, { apiKey = process.env.TAVILY_API_KEY, fetchImpl = fetch, signal, deadline } = {}) {
  try {
    checkDeadline(deadline, signal);
    if (typeof query !== 'string' || !query.trim() || query.length > 400) throw incompleteResult();
    if (!apiKey) throw researchUnavailable();
    const payload = await requestJson('https://api.tavily.com/search', {
      headers: { authorization: `Bearer ${apiKey}` }, fetchImpl, signal, deadline, timeoutMs: 30_000, research: true,
      body: { query, search_depth: 'advanced', max_results: 5, topic: 'general', auto_parameters: false, include_answer: false, include_raw_content: false, include_images: false, include_usage: true },
    });
    checkDeadline(deadline, signal);
    if (!Array.isArray(payload?.results)) throw researchUnavailable();
    const sources = payload.results.slice(0, 5).flatMap((item) => {
      const url = sourceUrl(item?.url);
      if (!url || typeof item.content !== 'string' || !item.content.trim()) return [];
      return [{ url, title: typeof item.title === 'string' && item.title.trim() ? item.title.slice(0, 300) : new URL(url).hostname, content: item.content.slice(0, 5000) }];
    });
    checkDeadline(deadline, signal);
    return sources;
  } catch (error) {
    try { checkDeadline(deadline, signal); }
    catch (reason) {
      if (reason instanceof AppError && reason.status === 504) throw deadlineExceeded();
      throw researchUnavailable();
    }
    throw error;
  }
}
