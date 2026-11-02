import { traditions, localize } from './catalog.js';
import { correspondenceSymbols } from './correspondences.js';

export const PERSONAL_STORAGE_KEY = 'sophia-pleroma-personal-v1';
export const PERSONAL_LIMITS = Object.freeze({ connections: 100, labelChars: 80, noteChars: 2000, fileBytes: 256 * 1024 });
const encoder = new TextEncoder();
const entities = new Map(traditions.map((tradition) => [tradition.id, new Map(tradition.nodes.map((node) => [node.id, node]))]));
const symbols = new Map(correspondenceSymbols.map((symbol) => [symbol.id, symbol]));
const duplicateKinds = {
  en: { faculty: 'Faculty', aeon: 'Aeon', sefirah: 'Sefirah' },
  he: { faculty: 'תכונה', aeon: 'איון', sefirah: 'ספירה' },
  ru: { faculty: 'Свойство', aeon: 'Эон', sefirah: 'Сефира' },
};
// Personal connections span all maps, so resolve ambiguity across traditions too.
const entityLabels = Object.fromEntries(['en', 'he', 'ru'].map((language) => {
  const named = traditions.flatMap((tradition) => tradition.nodes.map((node) => ({ tradition, node, label: localize(node.label, language) })));
  const counts = new Map();
  for (const { label } of named) counts.set(label, (counts.get(label) || 0) + 1);
  const labels = new Map(named.map(({ tradition, node, label }) => {
    const group = entities.get(tradition.id)?.get(node.group);
    const context = counts.get(label) > 1
      ? [duplicateKinds[language][node.kind] || localize(tradition.title, language), ...(group ? [localize(group.label, language)] : [])]
      : [];
    return [tradition.id + '/' + node.id, [label, ...context].join(' · ')];
  }));
  return [language, labels];
}));
// Module memory survives leaving the lazy explorer during this page session.
// Separate injected stores keep tests and alternate clients isolated.
const browserSession = { connections: [], pending: false };
const missingStoreSession = { connections: [], pending: false };
const injectedSessions = new WeakMap();
function sessionFor(storage) {
  if (storage === undefined) return browserSession;
  if (!storage || (typeof storage !== 'object' && typeof storage !== 'function')) return missingStoreSession;
  if (!injectedSessions.has(storage)) injectedSessions.set(storage, { connections: [], pending: false });
  return injectedSessions.get(storage);
}
const copyRecords = (records) => records.map((record) => ({ ...record, from: { ...record.from }, to: { ...record.to } }));

export class PersonalConnectionsError extends Error {
  constructor(code) { super('Invalid personal connections: ' + code); this.name = 'PersonalConnectionsError'; this.code = code; }
}
const fail = (code = 'invalid') => { throw new PersonalConnectionsError(code); };
function objectWithKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  const actual = Object.keys(value).sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== [...keys].sort()[index])) fail();
}
function text(value, limit, required = true) {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) fail('text');
  return value;
}
function endpoint(value, source = false) {
  if (value?.kind === 'entity') {
    objectWithKeys(value, ['kind', 'traditionId', 'nodeId']);
    if (!entities.get(value.traditionId)?.has(value.nodeId)) fail('endpoint');
    return { kind: 'entity', traditionId: value.traditionId, nodeId: value.nodeId };
  }
  if (!source && value?.kind === 'symbol') {
    objectWithKeys(value, ['kind', 'symbolId']);
    if (!symbols.has(value.symbolId)) fail('endpoint');
    return { kind: 'symbol', symbolId: value.symbolId };
  }
  if (!source && value?.kind === 'custom') {
    objectWithKeys(value, ['kind', 'label']);
    return { kind: 'custom', label: text(value.label, PERSONAL_LIMITS.labelChars) };
  }
  fail('endpoint');
}

export function validatePersonalConnections(value) {
  if (!Array.isArray(value)) fail();
  if (value.length > PERSONAL_LIMITS.connections) fail('limit');
  const seen = new Set();
  const clean = value.map((record) => {
    objectWithKeys(record, ['id', 'from', 'to', 'label', 'note']);
    if (typeof record.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/u.test(record.id) || seen.has(record.id)) fail('id');
    seen.add(record.id);
    const from = endpoint(record.from, true), to = endpoint(record.to);
    if (to.kind === 'entity' && from.traditionId === to.traditionId && from.nodeId === to.nodeId) fail('self');
    return { id: record.id, from, to, label: text(record.label, PERSONAL_LIMITS.labelChars), note: text(record.note, PERSONAL_LIMITS.noteChars, false) };
  });
  if (encoder.encode(JSON.stringify({ version: 1, connections: clean })).byteLength > PERSONAL_LIMITS.fileBytes) fail('size');
  return clean;
}

export function parsePersonalConnections(serialized) {
  if (typeof serialized !== 'string') fail();
  if (encoder.encode(serialized).byteLength > PERSONAL_LIMITS.fileBytes) fail('size');
  let document;
  try { document = JSON.parse(serialized); } catch { fail('json'); }
  objectWithKeys(document, ['version', 'connections']);
  if (document.version !== 1) fail('version');
  return validatePersonalConnections(document.connections);
}

export function importPersonalConnections(serialized, existing = []) {
  const current = validatePersonalConnections(existing);
  const imported = parsePersonalConnections(serialized);
  const byId = new Map(current.map((record) => [record.id, record]));
  for (const record of imported) {
    const previous = byId.get(record.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(record)) fail('conflict');
    if (!previous) byId.set(record.id, record);
  }
  return validatePersonalConnections([...byId.values()]);
}

export function exportPersonalConnections(connections) {
  // Compact JSON keeps every valid saved collection within the same import byte limit.
  return JSON.stringify({ version: 1, connections: validatePersonalConnections(connections) });
}

function browserStorage(storage) {
  return storage === undefined ? globalThis.localStorage : storage;
}

export function loadPersonalConnections(storage) {
  const session = sessionFor(storage);
  const recover = (warning) => ({ connections: copyRecords(session.connections), warning });
  // A failed explicit save must not be replaced by an older on-disk collection.
  if (session.pending) return recover('storage-unavailable');
  let serialized;
  try {
    const target = browserStorage(storage);
    if (!target?.getItem) return recover('storage-unavailable');
    serialized = target.getItem(PERSONAL_STORAGE_KEY);
  } catch { return recover('storage-unavailable'); }
  try {
    const connections = serialized === null ? [] : parsePersonalConnections(serialized);
    session.connections = copyRecords(connections);
    return { connections, warning: null };
  } catch { return recover('invalid-storage'); }
}

export function savePersonalConnections(connections, storage) {
  const serialized = exportPersonalConnections(connections);
  const session = sessionFor(storage);
  session.connections = copyRecords(connections);
  session.pending = true;
  try {
    const target = browserStorage(storage);
    if (!target?.setItem) return { saved: false, warning: 'storage-unavailable' };
    target.setItem(PERSONAL_STORAGE_KEY, serialized);
    session.pending = false;
    return { saved: true, warning: null };
  } catch { return { saved: false, warning: 'storage-unavailable' }; }
}

export function newPersonalConnectionId() {
  return 'personal-' + (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`);
}

export function personalEndpointLabel(value, language = 'en') {
  if (value?.kind === 'custom') return value.label;
  if (value?.kind === 'symbol') return localize(symbols.get(value.symbolId)?.label, language);
  return (entityLabels[language] || entityLabels.en).get(value?.traditionId + '/' + value?.nodeId) || '';
}

export function getPersonalSceneRecords(tradition, connections = []) {
  const traditionId = typeof tradition === 'string' ? tradition : tradition?.id;
  if (!entities.has(traditionId) || !Array.isArray(connections)) return [];
  return connections.flatMap((record) => {
    const fromLocal = record.from?.kind === 'entity' && record.from.traditionId === traditionId && entities.get(traditionId).has(record.from.nodeId);
    const toLocal = record.to?.kind === 'entity' && record.to.traditionId === traditionId && entities.get(traditionId).has(record.to.nodeId);
    if (!fromLocal && !toLocal) return [];
    const localEndpoint = fromLocal ? 'from' : 'to';
    const otherEndpoint = fromLocal ? record.to : record.from;
    return [{ ...record, localEndpoint, localNodeId: record[localEndpoint].nodeId,
      otherNodeId: fromLocal && toLocal ? record.to.nodeId : undefined, otherEndpoint,
      otherLabel: Object.fromEntries(['en', 'he', 'ru'].map((language) => [language, personalEndpointLabel(otherEndpoint, language)])) }];
  });
}
