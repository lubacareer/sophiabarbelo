import test from 'node:test';
import assert from 'node:assert/strict';
import { correspondenceSymbols } from './correspondences.js';
import { traditions } from './catalog.js';
import { exportPersonalConnections, getPersonalSceneRecords, importPersonalConnections, loadPersonalConnections, newPersonalConnectionId, parsePersonalConnections, personalEndpointLabel, PERSONAL_LIMITS, PERSONAL_STORAGE_KEY, savePersonalConnections, validatePersonalConnections } from './personal.js';

const source = { kind: 'entity', traditionId: 'tree', nodeId: 'binah' };
const target = { kind: 'entity', traditionId: 'john', nodeId: 'sophia' };
const record = (overrides = {}) => ({ id: 'personal-test', from: { ...source }, to: { ...target }, label: 'Understanding and wisdom', note: 'A personal reflection, not a source claim.', ...overrides });
const document = (connections, version = 1) => JSON.stringify({ version, connections });
const rejects = (fn, code) => assert.throws(fn, (error) => error.name === 'PersonalConnectionsError' && (!code || error.code === code));

test('personal connections round-trip all endpoint kinds without changing the input', () => {
  const records = [record(), record({ id: 'personal-symbol', to: { kind: 'symbol', symbolId: correspondenceSymbols[0].id }, label: 'סמל · Символ', note: '<script>plain text</script>\nA second line.' }), record({ id: 'personal-custom', to: { kind: 'custom', label: 'My own image' }, note: '' })];
  const before = structuredClone(records);
  const parsed = parsePersonalConnections(exportPersonalConnections(records));
  assert.deepEqual(parsed, records);
  assert.notEqual(parsed[0], records[0]);
  assert.notEqual(parsed[0].from, records[0].from);
  assert.deepEqual(records, before);
});

test('all canonical figures and palette symbols are valid while unknown endpoints are rejected', () => {
  for (const tradition of traditions) for (const node of tradition.nodes) {
    const from = { kind: 'entity', traditionId: tradition.id, nodeId: node.id };
    assert.equal(validatePersonalConnections([record({ from, to: { kind: 'custom', label: 'An idea' } })]).length, 1);
  }
  for (const symbol of correspondenceSymbols) assert.equal(validatePersonalConnections([record({ to: { kind: 'symbol', symbolId: symbol.id } })]).length, 1);
  for (const from of [{ kind: 'entity', traditionId: 'unknown', nodeId: 'binah' }, { kind: 'entity', traditionId: 'tree', nodeId: 'sophia' }, { kind: 'custom', label: 'Not a canonical source' }]) rejects(() => validatePersonalConnections([record({ from })]), 'endpoint');
  rejects(() => validatePersonalConnections([record({ to: { kind: 'symbol', symbolId: 'unknown-symbol' } })]), 'endpoint');
  rejects(() => validatePersonalConnections([record({ to: { ...source } })]), 'self');
});

test('untrusted imports reject malformed shapes, prototype keys, unsupported versions and duplicate IDs', () => {
  for (const value of [null, {}, 'records', 3]) rejects(() => validatePersonalConnections(value));
  rejects(() => parsePersonalConnections('not JSON'), 'json');
  rejects(() => parsePersonalConnections(document([], 2)), 'version');
  rejects(() => parsePersonalConnections(JSON.stringify({ version: 1, connections: [], extra: 'ignored?' })), 'invalid');
  rejects(() => parsePersonalConnections('{"version":1,"connections":[],"__proto__":{"polluted":true}}'), 'invalid');
  assert.equal({}.polluted, undefined);
  rejects(() => validatePersonalConnections([record({ id: '<script>' })]), 'id');
  rejects(() => validatePersonalConnections([record(), record()]), 'id');
  rejects(() => validatePersonalConnections([record({ note: { html: 'no objects' } })]), 'text');
  rejects(() => validatePersonalConnections([record({ from: { ...source, url: 'https://example.org' } })]), 'invalid');
});

test('limits bound record counts, labels, notes, and UTF-8 file size before import', () => {
  const hundred = Array.from({ length: PERSONAL_LIMITS.connections }, (_, i) => record({ id: 'personal-' + i }));
  assert.equal(validatePersonalConnections(hundred).length, 100);
  rejects(() => validatePersonalConnections([...hundred, record({ id: 'personal-overflow' })]), 'limit');
  assert.equal(validatePersonalConnections([record({ label: 'x'.repeat(80), note: 'x'.repeat(2000) })]).length, 1);
  rejects(() => validatePersonalConnections([record({ label: 'x'.repeat(81) })]), 'text');
  rejects(() => validatePersonalConnections([record({ note: 'x'.repeat(2001) })]), 'text');
  rejects(() => validatePersonalConnections([record({ label: '  ' })]), 'text');
  rejects(() => validatePersonalConnections([record({ to: { kind: 'custom', label: 'x'.repeat(81) } })]), 'text');
  rejects(() => parsePersonalConnections(' '.repeat(PERSONAL_LIMITS.fileBytes + 1)), 'size');
  rejects(() => parsePersonalConnections('א'.repeat(PERSONAL_LIMITS.fileBytes / 2 + 1)), 'size');
  const wide = hundred.map((item) => ({ ...item, note: '界'.repeat(2000) }));
  rejects(() => validatePersonalConnections(wide), 'size');
});

test('import merges atomically, ignores identical IDs, and never replaces conflicting existing entries', () => {
  const current = [record()];
  const before = structuredClone(current);
  const next = importPersonalConnections(document([record(), record({ id: 'personal-new' })]), current);
  assert.equal(next.length, 2);
  assert.deepEqual(next[0], current[0]);
  assert.deepEqual(current, before);
  assert.deepEqual(importPersonalConnections(document([record()]), current), current);
  rejects(() => importPersonalConnections(document([record({ id: 'personal-new' }), record({ note: 'Conflict' })]), current), 'conflict');
  assert.deepEqual(current, before);
  const hundred = Array.from({ length: 100 }, (_, i) => record({ id: 'personal-' + i }));
  rejects(() => importPersonalConnections(document([record()]), hundred), 'limit');
  assert.equal(hundred.length, 100);
});

test('storage uses a versioned key and writes only through an explicit save', () => {
  const calls = [];
  let value = null;
  const storage = { getItem(key) { calls.push(['get', key]); return value; }, setItem(key, serialized) { calls.push(['set', key]); value = serialized; } };
  assert.deepEqual(loadPersonalConnections(storage), { connections: [], warning: null });
  assert.deepEqual(calls, [['get', PERSONAL_STORAGE_KEY]]);
  assert.deepEqual(savePersonalConnections([record()], storage), { saved: true, warning: null });
  assert.equal(calls[1][1], PERSONAL_STORAGE_KEY);
  assert.equal(JSON.parse(value).version, 1);
  assert.deepEqual(loadPersonalConnections(storage), { connections: [record()], warning: null });
});

test('unavailable or corrupt storage never erases data and leaves caller-owned records usable', () => {
  const existing = [record()];
  const blocked = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Quota'); } };
  assert.deepEqual(loadPersonalConnections(blocked), { connections: [], warning: 'storage-unavailable' });
  assert.deepEqual(savePersonalConnections(existing, blocked), { saved: false, warning: 'storage-unavailable' });
  assert.deepEqual(loadPersonalConnections(null), { connections: [], warning: 'storage-unavailable' });
  assert.deepEqual(savePersonalConnections(existing, null), { saved: false, warning: 'storage-unavailable' });
  let writes = 0;
  const corrupt = { getItem() { return 'broken stored JSON'; }, setItem() { writes++; } };
  assert.deepEqual(loadPersonalConnections(corrupt), { connections: [], warning: 'invalid-storage' });
  assert.equal(writes, 0);
  assert.deepEqual(existing, [record()]);
  assert.equal(parsePersonalConnections(exportPersonalConnections(existing)).length, 1);
});

test('unsaved storage falls back to session memory across explorer remounts and never restores stale disk records', () => {
  let blocked = false;
  let persisted = document([record()]);
  let writes = 0;
  const storage = { getItem() { return persisted; }, setItem(key, value) { writes++; if (blocked) throw new Error('Quota'); persisted = value; } };
  const loaded = loadPersonalConnections(storage);
  assert.equal(loaded.connections.length, 1);
  const edited = [record({ note: 'Keep this edit in memory' })];
  blocked = true;
  assert.equal(savePersonalConnections(edited, storage).saved, false);
  edited[0].note = 'External mutation';
  const remounted = loadPersonalConnections(storage);
  assert.equal(remounted.warning, 'storage-unavailable');
  assert.equal(remounted.connections[0].note, 'Keep this edit in memory');
  remounted.connections[0].note = 'Another external mutation';
  blocked = false;
  const recovered = loadPersonalConnections(storage);
  assert.equal(recovered.connections[0].note, 'Keep this edit in memory');
  assert.equal(writes, 1, 'reads never retry writes implicitly');
  assert.equal(savePersonalConnections(recovered.connections, storage).saved, true);
  assert.equal(loadPersonalConnections(storage).warning, null);
  assert.equal(parsePersonalConnections(persisted)[0].note, 'Keep this edit in memory');
});

test('scene records retain cross-tradition identity and appear from either endpoint without duplicate same-map curves', () => {
  const cross = record();
  const local = record({ id: 'personal-local', to: { kind: 'entity', traditionId: 'tree', nodeId: 'keter' } });
  const symbol = record({ id: 'personal-symbol', to: { kind: 'symbol', symbolId: correspondenceSymbols[0].id } });
  const custom = record({ id: 'personal-custom', to: { kind: 'custom', label: 'My symbol' } });
  const records = [cross, local, symbol, custom];
  const scene = getPersonalSceneRecords('tree', records);
  assert.equal(scene.length, 4);
  assert.equal(scene[0].localEndpoint, 'from');
  assert.equal(scene[0].localNodeId, 'binah');
  assert.equal(scene[0].otherNodeId, undefined);
  assert.equal(scene[1].otherNodeId, 'keter');
  assert.equal(scene[3].otherLabel.en, 'My symbol');
  const john = getPersonalSceneRecords({ id: 'john' }, records);
  assert.equal(john.length, 1);
  assert.equal(john[0].localEndpoint, 'to');
  assert.equal(john[0].localNodeId, 'sophia');
  assert.deepEqual(john[0].otherEndpoint, source);
  assert.deepEqual(getPersonalSceneRecords('ezekiel', records), []);
  assert.deepEqual(getPersonalSceneRecords('unknown', records), []);
  assert.deepEqual(getPersonalSceneRecords('tree'), []);
  for (const language of ['en', 'he', 'ru']) assert.ok(personalEndpointLabel(source, language));
});

test('new personal IDs are unique and valid for safe DOM and scene identifiers', () => {
  const ids = Array.from({ length: 100 }, () => newPersonalConnectionId());
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.equal(validatePersonalConnections([record({ id })])[0].id, id);
});

test('the two Truth figures remain identifiable in every locale, including saved endpoint and visit labels', () => {
  const faculty = { kind: 'entity', traditionId: 'john', nodeId: 'truth-faculty' };
  const aeon = { kind: 'entity', traditionId: 'john', nodeId: 'truth' };
  const expected = {
    en: ['Truth · Faculty', 'Truth · Aeon · Armozel'],
    he: ['אמת · תכונה', 'אמת · איון · ארמוזל'],
    ru: ['Истина · Свойство', 'Истина · Эон · Армозел'],
  };
  for (const language of ['en', 'he', 'ru']) {
    const labels = [personalEndpointLabel(faculty, language), personalEndpointLabel(aeon, language)];
    assert.notEqual(labels[0], labels[1], language);
    assert.deepEqual(labels, expected[language], language);
    const connection = record({ from: faculty, to: aeon });
    const saved = parsePersonalConnections(exportPersonalConnections([connection]))[0];
    assert.deepEqual([personalEndpointLabel(saved.from, language), personalEndpointLabel(saved.to, language)], labels);
    assert.equal(getPersonalSceneRecords('john', [saved])[0].otherLabel[language], labels[1]);
  }
  assert.notEqual(personalEndpointLabel({ kind: 'entity', traditionId: 'john', nodeId: 'grace' }, 'he'), personalEndpointLabel({ kind: 'entity', traditionId: 'tree', nodeId: 'chesed' }, 'he'));
  assert.equal(personalEndpointLabel(faculty, 'unsupported'), expected.en[0]);
});
