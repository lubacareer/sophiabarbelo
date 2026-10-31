import { AppError } from './errors.js';
import { analyzeWithGrok } from './grok.js';
import { analyzeWithGroq } from './groq.js';

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
  return (process.env.ANALYSIS_PROVIDER || 'xai').toLowerCase() === 'xai';
}

async function freeResearch(text, groq) {
  if (process.env.SOPHIA_GROQ_FREE_CONFIRMED !== 'true') {
    throw new AppError(503, 'Free web research is not configured. Please try again later.');
  }
  for (const [index, model] of freeModels.entries()) {
    try {
      const result = await groq(text, { model, requireCitations: true, maxRetryWaitSeconds: 0 });
      if (index > 0) result.limitations.push('The primary research model was unavailable, so a free fallback model was used.');
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
    return freeResearch(text, groq);
  }
  if (role === 'admin') {
    try { return await grok(text, { ...options, model: 'grok-4.7' }); }
    catch (error) {
      if (!error?.providerRateLimited) throw error;
      const result = await freeResearch(text, groq);
      result.limitations.push('Grok reached its usage limit, so a free research model was used.');
      return result;
    }
  }
  const provider = (process.env.ANALYSIS_PROVIDER || 'xai').toLowerCase();
  if (provider === 'xai') return grok(text, options);
  if (provider === 'groq') {
    if (options.reasoningEffort) throw new AppError(400, 'Reasoning settings are available for Grok only. Select Default for Groq.');
    return groq(text);
  }
  throw new AppError(503, 'Analysis is unavailable: configure ANALYSIS_PROVIDER as groq or xai.');
}
