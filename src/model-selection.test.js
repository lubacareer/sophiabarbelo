import test from 'node:test';
import assert from 'node:assert/strict';
import { modelLabels, modelLabel, modelRequestSettings, modelStorageKey, parseModelConfig, rememberModel, savedModel, selectedModel } from './model-selection.js';

const configured = () => ({
  models: Object.entries(modelLabels).map(([id, label]) => ({
    id, label, available: id !== 'glm-4.7-flash', unavailableReason: id === 'glm-4.7-flash' ? 'not_configured' : null,
    reasoningControls: id === 'grok-4.7', access: id === 'glm-4.7-flash' ? 'free' : 'credits',
  })),
  defaultModelId: 'luna', reasoningControls: false,
});

test('deployed model settings select Luna by default without inferring availability from order', () => {
  const input = configured();
  input.models.reverse();
  const config = parseModelConfig(input);
  assert.equal(config.kind, 'models');
  assert.equal(selectedModel(config, null).id, 'luna');
  assert.deepEqual(modelRequestSettings(config, null), { modelId: 'luna' });
  input.models.find(({ id }) => id === 'luna').available = false;
  assert.equal(selectedModel(config, null).available, true, 'The normalized config must not retain mutable response records.');
});

test('remembered unavailable or removed models stay selected until an explicit new choice', () => {
  const config = parseModelConfig(configured());
  for (const id of ['glm-4.7-flash', 'previous-model', 'constructor']) {
    const selection = selectedModel(config, id);
    assert.equal(selection.id, id);
    assert.equal(selection.available, false);
    assert.equal(typeof selection.label, 'string', 'Unknown stored IDs must remain inert display text.');
    assert.equal(modelRequestSettings(config, id), null, 'An unavailable choice must never silently submit to Luna.');
  }
  assert.deepEqual(modelRequestSettings(config, 'gemini-3.8-flash'), { modelId: 'gemini-3.8-flash' });
  const input = configured();
  input.models.find(({ id }) => id === 'luna').available = false;
  input.models.find(({ id }) => id === 'luna').unavailableReason = 'not_configured';
  assert.equal(modelRequestSettings(parseModelConfig(input), null), null, 'An unavailable default must not auto-select another model.');
});

test('malformed deployed settings fail closed rather than masquerading as a legacy local server', () => {
  const malformed = [null, {}, [], { models: null, reasoningControls: false }, { models: [], reasoningControls: true }];
  for (const mutate of [
    (value) => { value.defaultModelId = 'unknown'; },
    (value) => { value.models[1].id = 'luna'; },
    (value) => { value.models[0].available = 'true'; },
    (value) => { value.models[0].unavailableReason = 'not_configured'; },
    (value) => { value.models[0].access = 'unknown'; },
    (value) => { delete value.models[0].reasoningControls; },
  ]) {
    const value = configured();
    mutate(value);
    malformed.push(value);
  }
  for (const value of malformed) assert.throws(() => parseModelConfig(value));
  assert.equal(modelRequestSettings(null, 'luna'), null);
});

test('request settings include only the selected model and its allowed reasoning depth', () => {
  const admin = parseModelConfig(configured());
  assert.deepEqual(modelRequestSettings(admin, 'grok-4.7', 'high'), { modelId: 'grok-4.7', reasoningEffort: 'high' });
  assert.deepEqual(modelRequestSettings(admin, 'luna', 'high'), { modelId: 'luna' });
  assert.deepEqual(modelRequestSettings(admin, 'gemini-3.8-flash', 'high'), { modelId: 'gemini-3.8-flash' });
  assert.deepEqual(modelRequestSettings(admin, 'grok-4.7', 'unrecognized'), { modelId: 'grok-4.7' });
  const input = configured();
  input.models.find(({ id }) => id === 'grok-4.7').reasoningControls = false;
  assert.deepEqual(modelRequestSettings(parseModelConfig(input), 'grok-4.7', 'high'), { modelId: 'grok-4.7' }, 'Public Grok must omit any stale administrator depth.');
});

test('legacy local configuration keeps its provider and omits modelId', () => {
  for (const reasoningControls of [false, true]) {
    const config = parseModelConfig({ reasoningControls });
    assert.equal(selectedModel(config, 'luna'), null);
    assert.deepEqual(modelRequestSettings(config, 'luna', 'high'), reasoningControls ? { reasoningEffort: 'high' } : {});
  }
});

test('model persistence uses the provided origin storage and tolerates disabled storage', () => {
  const storage = () => {
    const entries = new Map();
    return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  };
  const publicOrigin = storage();
  const administratorOrigin = storage();
  rememberModel('glm-4.7-flash', publicOrigin);
  rememberModel('grok-4.7', administratorOrigin);
  assert.equal(publicOrigin.getItem(modelStorageKey), 'glm-4.7-flash');
  assert.equal(savedModel(publicOrigin), 'glm-4.7-flash');
  assert.equal(savedModel(administratorOrigin), 'grok-4.7');
  for (const value of [null, '', '<script>', 'x'.repeat(81)]) assert.equal(savedModel({ getItem: () => value }), null);
  const blocked = { getItem: () => { throw new Error('Storage disabled'); }, setItem: () => { throw new Error('Storage disabled'); } };
  assert.equal(savedModel(blocked), null);
  assert.doesNotThrow(() => rememberModel('luna', blocked));
});

test('result attribution resolves its response model independently of the next selected model', () => {
  const config = parseModelConfig(configured());
  assert.equal(selectedModel(config, 'gemini-3.8-flash').id, 'gemini-3.8-flash');
  assert.equal(modelLabel('luna', config), 'GPT-6 Luna');
  assert.equal(modelLabel('grok-4.7'), 'Grok 4.7', 'Attribution remains available while configuration reloads.');
});
