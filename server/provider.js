import { AppError } from './errors.js';
import { analyzeWithGrok } from './grok.js';
import { analyzeWithGroq } from './groq.js';
import { analyzeWithOpenAI } from './openai.js';
import { localize } from './localization.js';

const freeModel = 'openai/gpt-oss-120b';

function deploymentRole() {
  if (!process.env.VERCEL) return 'local';
  const role = process.env.SOPHIA_DEPLOYMENT_ROLE;
  if (!['public', 'admin'].includes(role)) throw new AppError(503, 'Analysis is unavailable: the deployment role is not configured.');
  return role;
}

export function supportsReasoning() {
  const role = deploymentRole();
  if (role === 'public') return false;
  if (role === 'admin') return true;
  return (process.env.ANALYSIS_PROVIDER || 'xai').toLowerCase() === 'xai'
    && (process.env.XAI_MODEL || 'grok-4.7') === 'grok-4.7';
}

async function freeResearch(text, groq, options) {
  if (process.env.SOPHIA_GROQ_FREE_CONFIRMED !== 'true') {
    throw new AppError(503, 'Free web research is not configured. Please try again later.');
  }
  return groq(text, { ...(options.language !== undefined ? { language: options.language } : {}), model: freeModel, requireCitations: true, maxRetryWaitSeconds: 30 });
}

export async function analyzeConfigured(text, options = {}, { grok = analyzeWithGrok, groq = analyzeWithGroq, openai = analyzeWithOpenAI } = {}) {
  const role = deploymentRole();
  if (role === 'public') {
    if (options.reasoningEffort) throw new AppError(400, 'Reasoning settings are available for Grok only.');
    const publicProvider = (process.env.SOPHIA_PUBLIC_PROVIDER || 'groq').toLowerCase();
    if (publicProvider === 'groq') return freeResearch(text, groq, options);
    if (publicProvider === 'openai') {
      if (process.env.SOPHIA_OPENAI_COSTS_CONFIRMED !== 'true') {
        throw new AppError(503, 'Analysis is unavailable: OpenAI usage costs are not configured.');
      }
      return openai(text, { ...(options.language !== undefined ? { language: options.language } : {}), model: 'gpt-6-luna', requireCitations: true });
    }
    throw new AppError(503, 'Analysis is unavailable: the public provider is not configured.');
  }
  if (role === 'admin') {
    try { return await grok(text, { ...options, model: 'grok-4.7' }); }
    catch (error) {
      if (!error?.providerRateLimited) throw error;
      const result = await freeResearch(text, groq, options);
      result.limitations.push(localize('Grok reached its usage limit, so a free research model was used.', options.language));
      return result;
    }
  }
  const provider = (process.env.ANALYSIS_PROVIDER || 'xai').toLowerCase();
  if (provider === 'xai') return grok(text, options);
  if (provider === 'groq') {
    if (options.reasoningEffort) throw new AppError(400, 'Reasoning settings are available for Grok only. Select Default for Groq.');
    return groq(text, options);
  }
  if (provider === 'openai') {
    if (options.reasoningEffort) throw new AppError(400, 'Reasoning settings are available for Grok only.');
    return openai(text, options);
  }
  throw new AppError(503, 'Analysis is unavailable: configure ANALYSIS_PROVIDER as groq, openai, or xai.');
}
