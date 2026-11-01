import { AppError } from './errors.js';
import { analyzeWithGrok } from './grok.js';
import { analyzeWithGroq } from './groq.js';
import { localize } from './localization.js';

const freeModels = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];

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
  for (const [index, model] of freeModels.entries()) {
    try {
      const result = await groq(text, { ...(options.language !== undefined ? { language: options.language } : {}), model, requireCitations: true, maxRetryWaitSeconds: 30 });
      if (index > 0) result.limitations.push(localize('The primary research model was unavailable, so a free fallback model was used.', options.language));
      return result;
    } catch (error) {
      if ((error?.status !== 429 && !error?.providerResearchUnavailable) || index === freeModels.length - 1) throw error;
    }
  }
}

export async function analyzeConfigured(text, options = {}, { grok = analyzeWithGrok, groq = analyzeWithGroq } = {}) {
  const role = deploymentRole();
  if (role === 'public') {
    if (options.reasoningEffort) throw new AppError(400, 'Reasoning settings are available for Grok only.');
    return freeResearch(text, groq, options);
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
  throw new AppError(503, 'Analysis is unavailable: configure ANALYSIS_PROVIDER as groq or xai.');
}
