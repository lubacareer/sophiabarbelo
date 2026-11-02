import { AppError } from './errors.js';
import { analyzeWithResearch } from './research.js';
import { incompleteResult, parseModelJson, requestJson } from './research-http.js';

const model = 'gemini-3.8-flash';

export async function analyzeWithGemini(text, { apiKey = process.env.GEMINI_API_KEY, tavilyApiKey = process.env.TAVILY_API_KEY, language, fetchImpl = fetch, signal } = {}) {
  if (!apiKey) throw new AppError(503, 'Analysis is temporarily unavailable. Please try again later.');
  async function complete({ system, input, schema, maxTokens, signal: deadline }) {
    const data = await requestJson('https://generativelanguage.googleapis.com/v1beta/interactions', {
      headers: { 'x-goog-api-key': apiKey }, fetchImpl, signal: deadline,
      body: { model, store: false, stream: false, system_instruction: system, input, generation_config: { thinking_level: 'low', thinking_summaries: 'none', max_output_tokens: maxTokens }, response_format: { type: 'text', mime_type: 'application/json', schema } },
    });
    if (data?.status !== 'completed' || !Array.isArray(data.steps)) throw incompleteResult();
    const output = data.steps.filter((step) => step?.type === 'model_output').flatMap((step) => Array.isArray(step.content) ? step.content : []);
    if (!output.length || output.some((item) => item?.type !== 'text' || typeof item.text !== 'string')) throw incompleteResult();
    return parseModelJson(output.map((item) => item.text).join(''));
  }
  return analyzeWithResearch(text, { complete, language, tavilyApiKey, fetchImpl, signal });
}
