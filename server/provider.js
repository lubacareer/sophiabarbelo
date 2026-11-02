import { AppError } from './errors.js';
import { analyzeWithGrok } from './grok.js';
import { analyzeWithGroq } from './groq.js';
import { analyzeWithOpenAI } from './openai.js';
import { analyzeWithGemini } from './gemini.js';
import { analyzeWithCloudflare } from './cloudflare.js';
import { resolveAnalysisModel } from './models.js';

export { analysisConfiguration, resolveAnalysisModel, supportsReasoning } from './models.js';

export async function analyzeConfigured(text, options = {}, {
  deployment = 'local', environment = process.env,
  grok = analyzeWithGrok, groq = analyzeWithGroq, openai = analyzeWithOpenAI,
  gemini = analyzeWithGemini, cloudflare = analyzeWithCloudflare,
} = {}) {
  const selected = resolveAnalysisModel(options, { deployment, environment });
  if (selected) {
    const adapter = { xai: grok, openai, gemini, cloudflare }[selected.provider];
    const providerOptions = {
      ...(options.language !== undefined ? { language: options.language } : {}),
      model: selected.model,
      ...(selected.provider !== 'xai' ? { requireCitations: true } : {}),
    };
    if (selected.provider === 'xai') {
      if (deployment === 'public') providerOptions.reasoningEffort = 'low';
      else if (options.reasoningEffort !== undefined) providerOptions.reasoningEffort = options.reasoningEffort;
    }
    const result = await adapter(text, providerOptions);
    return { ...result, analysisModelId: selected.id };
  }
  // Caddy administrator identity affects quota exemption, while local provider
  // and model selection keep using the existing server environment.
  const provider = (environment.ANALYSIS_PROVIDER || 'xai').toLowerCase();
  if (provider === 'xai') return grok(text, options);
  if (provider === 'groq') return groq(text, options);
  if (provider === 'openai') return openai(text, options);
  throw new AppError(503, 'Analysis is unavailable: configure ANALYSIS_PROVIDER as groq, openai, or xai.');
}
