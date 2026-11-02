import { AppError } from './errors.js';

export const DEFAULT_MODEL_ID = 'luna';

const models = Object.freeze([
  Object.freeze({ id: 'luna', label: 'GPT-6 Luna', provider: 'openai', model: 'gpt-6-luna', access: 'credits' }),
  Object.freeze({ id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', provider: 'gemini', model: 'gemini-3.8-flash', access: 'free' }),
  Object.freeze({ id: 'glm-4.7-flash', label: 'GLM-4.7-Flash', provider: 'cloudflare', model: '@cf/zai-org/glm-4.7-flash', access: 'free' }),
  Object.freeze({ id: 'grok-4.7', label: 'Grok 4.7', provider: 'xai', model: 'grok-4.7', access: 'credits' }),
]);

function assertDeployment(deployment) {
  if (!['local', 'public', 'admin'].includes(deployment)) {
    throw new AppError(503, 'Analysis is unavailable: the deployment role is not configured.');
  }
}

function geminiAccess(environment) {
  // Paid activation takes precedence over a stale free-tier confirmation.
  return environment.SOPHIA_GEMINI_COSTS_CONFIRMED === 'true' || environment.SOPHIA_GEMINI_FREE_CONFIRMED !== 'true' ? 'credits' : 'free';
}

function configured(model, deployment, environment) {
  const has = (name) => typeof environment[name] === 'string' && Boolean(environment[name].trim());
  const confirmed = (name) => environment[name] === 'true';
  if (model.provider === 'openai') return has('OPENAI_API_KEY') && confirmed('SOPHIA_OPENAI_COSTS_CONFIRMED');
  if (model.provider === 'xai') return has('XAI_API_KEY') && (deployment === 'admin' || confirmed('SOPHIA_PUBLIC_XAI_COSTS_CONFIRMED'));
  const tavily = has('TAVILY_API_KEY') && confirmed('SOPHIA_TAVILY_FREE_CONFIRMED');
  if (model.provider === 'gemini') return tavily && has('GEMINI_API_KEY') && (confirmed('SOPHIA_GEMINI_FREE_CONFIRMED') || confirmed('SOPHIA_GEMINI_COSTS_CONFIRMED'));
  return tavily && has('CLOUDFLARE_API_TOKEN') && /^[a-f0-9]{32}$/i.test(environment.CLOUDFLARE_ACCOUNT_ID || '') && confirmed('SOPHIA_CLOUDFLARE_FREE_CONFIRMED');
}

export function supportsReasoning({ deployment = 'local', modelId, environment = process.env } = {}) {
  assertDeployment(deployment);
  if (deployment !== 'local') return deployment === 'admin' && modelId === 'grok-4.7';
  return (environment.ANALYSIS_PROVIDER || 'xai').toLowerCase() === 'xai'
    && (environment.XAI_MODEL || 'grok-4.7') === 'grok-4.7';
}

export function analysisConfiguration({ deployment = 'local', environment = process.env } = {}) {
  assertDeployment(deployment);
  // Local/Caddy use their existing environment-selected provider and controls.
  if (deployment === 'local') return { reasoningControls: supportsReasoning({ deployment, environment }) };
  return {
    models: models.map(({ id, label, access, ...model }) => {
      const available = configured(model, deployment, environment);
      return { id, label, available, unavailableReason: available ? null : 'not_configured', reasoningControls: supportsReasoning({ deployment, modelId: id, environment }), access: model.provider === 'gemini' ? geminiAccess(environment) : access };
    }),
    defaultModelId: DEFAULT_MODEL_ID,
    reasoningControls: false,
  };
}

export function resolveAnalysisModel(options = {}, { deployment = 'local', environment = process.env } = {}) {
  assertDeployment(deployment);
  const { modelId, reasoningEffort } = options;
  if (reasoningEffort !== undefined && !['low', 'medium', 'high'].includes(reasoningEffort)) {
    throw new AppError(400, 'Choose a valid reasoning setting.');
  }
  if (deployment === 'local') {
    if (modelId !== undefined) throw new AppError(400, 'Model selection is available on deployed public and administrator sites only.');
    const provider = (environment.ANALYSIS_PROVIDER || 'xai').toLowerCase();
    if (reasoningEffort !== undefined && provider !== 'xai') {
      throw new AppError(400, provider === 'groq' ? 'Reasoning settings are available for Grok only. Select Default for Groq.' : 'Reasoning settings are available for Grok only.');
    }
    return null;
  }
  const selected = models.find((model) => model.id === (modelId === undefined ? DEFAULT_MODEL_ID : modelId));
  if (!selected) throw new AppError(400, 'Choose a valid analysis model.');
  if (reasoningEffort !== undefined && !supportsReasoning({ deployment, modelId: selected.id, environment })) {
    throw new AppError(400, 'Reasoning settings are available for administrator Grok 4.7 only.');
  }
  if (!configured(selected, deployment, environment)) {
    throw new AppError(503, 'The selected analysis model is not configured. Please try again later.');
  }
  return selected.provider === 'gemini' ? Object.freeze({ ...selected, access: geminiAccess(environment) }) : selected;
}
