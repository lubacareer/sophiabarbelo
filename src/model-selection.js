export const modelStorageKey = 'sophia-analysis-model';
export const modelLabels = Object.freeze({
  luna: 'GPT-6 Luna',
  'gemini-3.8-flash': 'Gemini 3.8 Flash',
  'glm-4.7-flash': 'GLM-4.7-Flash',
  'grok-4.7': 'Grok 4.7',
});

const validId = (id) => typeof id === 'string' && /^[a-z0-9][a-z0-9.-]{0,79}$/u.test(id);

// A legacy local server advertises only its reasoning control. A malformed
// deployed response must not fall back to that legacy request shape.
export function parseModelConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid analysis configuration');
  if (!Object.hasOwn(value, 'models')) {
    if (Object.hasOwn(value, 'defaultModelId') || typeof value.reasoningControls !== 'boolean') throw new Error('Invalid analysis configuration');
    return { kind: 'legacy', reasoningControls: value.reasoningControls, ...(value.symbolicReadings === true ? { symbolicReadings: true } : {}) };
  }
  const ids = Object.keys(modelLabels);
  if (!Array.isArray(value.models) || value.models.length !== ids.length) throw new Error('Invalid model configuration');
  const models = value.models.map((model) => {
    if (!model || !Object.hasOwn(modelLabels, model.id) || typeof model.label !== 'string' || !model.label.trim()
      || typeof model.available !== 'boolean' || typeof model.reasoningControls !== 'boolean'
      || !['credits', 'free'].includes(model.access)
      || (model.available ? model.unavailableReason !== null : model.unavailableReason !== 'not_configured')) throw new Error('Invalid model configuration');
    return { id: model.id, label: model.label, available: model.available, unavailableReason: model.unavailableReason, reasoningControls: model.reasoningControls, access: model.access };
  });
  if (new Set(models.map(({ id }) => id)).size !== ids.length || !models.some(({ id }) => id === value.defaultModelId)) throw new Error('Invalid model configuration');
  return { kind: 'models', models, defaultModelId: value.defaultModelId, ...(value.symbolicReadings === true ? { symbolicReadings: true } : {}) };
}

export function savedModel(storage) {
  try {
    const id = (storage ?? globalThis.localStorage).getItem(modelStorageKey);
    return validId(id) ? id : null;
  } catch { return null; }
}

export function rememberModel(id, storage) {
  if (!validId(id)) return;
  try { (storage ?? globalThis.localStorage).setItem(modelStorageKey, id); }
  catch { /* Selecting a model remains possible when browser storage is disabled. */ }
}

export function selectedModel(config, rememberedId) {
  if (config?.kind !== 'models') return null;
  const id = rememberedId || config.defaultModelId;
  return config.models.find((model) => model.id === id) || {
    id, label: Object.hasOwn(modelLabels, id) ? modelLabels[id] : id, available: false, unavailableReason: 'not_configured', reasoningControls: false, access: null,
  };
}

// Returning null blocks unknown/unavailable configurations. Unsupported depth
// never leaks from a previously selected model into the next request.
export function modelRequestSettings(config, rememberedId, reasoningEffort = '') {
  if (!config) return null;
  const model = selectedModel(config, rememberedId);
  if (config.kind !== 'legacy' && (!model || !model.available)) return null;
  const supportsReasoning = config.kind === 'legacy' ? config.reasoningControls : model.reasoningControls;
  return {
    ...(config.kind === 'models' ? { modelId: model.id } : {}),
    ...(supportsReasoning && ['low', 'medium', 'high'].includes(reasoningEffort) ? { reasoningEffort } : {}),
  };
}

export function modelLabel(id, config) {
  return config?.models?.find((model) => model.id === id)?.label || (Object.hasOwn(modelLabels, id) ? modelLabels[id] : id);
}
