import { AppError } from './errors.js';
import { analyzeWithResearch, querySchema, RESEARCH_LIMITS } from './research.js';
import { incompleteResult, parseModelJson, requestJson } from './research-http.js';
import { checkDeadline } from './deadline.js';

const model = '@cf/zai-org/glm-4.7-flash';

export async function analyzeWithCloudflare(text, { accountId = process.env.CLOUDFLARE_ACCOUNT_ID, apiToken = process.env.CLOUDFLARE_API_TOKEN, tavilyApiKey = process.env.TAVILY_API_KEY, language, fetchImpl = fetch, signal, deadline, logger, includeSymbolicReadings = false } = {}) {
  if (typeof accountId !== 'string' || !/^[a-f0-9]{32}$/i.test(accountId) || !apiToken) throw new AppError(503, 'Analysis is temporarily unavailable. Please try again later.');
  async function complete({ system, input, schema, maxTokens, signal: requestSignal, deadline: stageDeadline }) {
    checkDeadline(stageDeadline, requestSignal);
    const data = await requestJson(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`, {
      headers: { authorization: `Bearer ${apiToken}` }, fetchImpl, signal: requestSignal, deadline: stageDeadline, logger,
      timeoutMs: RESEARCH_LIMITS.timeoutMs, stage: schema === querySchema ? 'query' : 'analysis',
      // Reserve the small query-planning budget for query JSON; final analysis
      // retains the model's normal reasoning behavior.
      body: { model, store: false, stream: false, max_completion_tokens: maxTokens, ...(schema === querySchema ? { chat_template_kwargs: { enable_thinking: false } } : {}), messages: [{ role: 'system', content: system }, { role: 'user', content: input }], response_format: { type: 'json_schema', json_schema: { name: 'passage_analysis', strict: true, schema } } },
    });
    checkDeadline(stageDeadline, requestSignal);
    const choice = data?.choices?.[0];
    if (!choice || choice.finish_reason !== 'stop' || choice.message?.refusal || choice.message?.tool_calls?.length || typeof choice.message?.content !== 'string') throw incompleteResult();
    const parsed = parseModelJson(choice.message.content);
    checkDeadline(stageDeadline, requestSignal);
    return parsed;
  }
  return analyzeWithResearch(text, { complete, language, tavilyApiKey, fetchImpl, signal, deadline, includeSymbolicReadings });
}
