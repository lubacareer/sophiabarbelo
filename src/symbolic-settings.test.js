import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSymbolicResponse, rememberSymbolicSetting, savedSymbolicSetting, symbolicStorageKey } from './symbolic-settings.js';

const sourceText = 'The moon reflects light. הירח משקף אור. Луна отражает свет.';
const reflection = () => ({ excerpt: 'הירח משקף אור.', title: 'אפשרות', reading: 'קריאה אפשרית.', reflectionQuestion: 'מה עולה בך?', basis: 'reflection', tradition: '', sources: [] });
const tradition = () => ({ excerpt: 'Луна отражает свет.', title: 'Возможный смысл', reading: 'Возможное прочтение.', reflectionQuestion: 'Что это вызывает у вас?', basis: 'tradition', tradition: 'Named system', sources: [{ title: 'Source', url: 'https://example.org/source' }] });
const response = (...items) => ({ claims: [], rhetoric: [], limitations: [], sourceText, analysisModelId: 'luna', symbolicReadings: items });

test('symbolic preference defaults off, is per origin, and tolerates unavailable storage', () => {
  const storage = () => {
    const entries = new Map();
    return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  };
  const publicOrigin = storage(), adminOrigin = storage();
  assert.equal(savedSymbolicSetting(publicOrigin), false);
  rememberSymbolicSetting(true, publicOrigin);
  assert.equal(publicOrigin.getItem(symbolicStorageKey), 'true');
  assert.equal(savedSymbolicSetting(publicOrigin), true);
  assert.equal(savedSymbolicSetting(adminOrigin), false);
  rememberSymbolicSetting(false, publicOrigin);
  assert.equal(savedSymbolicSetting(publicOrigin), false);
  for (const value of [null, undefined, '', 'TRUE', 'false', '1', true, '{}']) assert.equal(savedSymbolicSetting({ getItem: () => value }), false);
  const blocked = { getItem: () => { throw new Error('Unavailable storage'); }, setItem: () => { throw new Error('Unavailable storage'); } };
  assert.equal(savedSymbolicSetting(blocked), false);
  assert.doesNotThrow(() => rememberSymbolicSetting(true, blocked));
});

test('symbolic response validation retains exact excerpts and independent result data', () => {
  const input = response(reflection(), tradition());
  const actual = parseSymbolicResponse(input, true);
  assert.deepEqual(actual, input);
  assert.notEqual(actual.symbolicReadings, input.symbolicReadings);
  input.symbolicReadings[1].sources[0].title = 'Changed later';
  assert.equal(actual.symbolicReadings[1].sources[0].title, 'Source');
  const pref = { setItem: () => {} };
  rememberSymbolicSetting(false, pref);
  assert.equal(actual.symbolicReadings.length, 2, 'Changing the next-request preference must not remove existing readings.');
  assert.deepEqual(parseSymbolicResponse(response(), true).symbolicReadings, []);
});

test('unrequested readings are removed without requiring newer server fields', () => {
  const old = { claims: [], rhetoric: [], sourceText };
  assert.deepEqual(parseSymbolicResponse(old), old);
  assert.deepEqual(parseSymbolicResponse({ ...old, symbolicReadings: [null] }, false), old);
  const input = response(reflection());
  assert.equal(Object.hasOwn(parseSymbolicResponse(input, false), 'symbolicReadings'), false);
  assert.equal(input.symbolicReadings.length, 1, 'The response input is not mutated.');
});

test('malformed reading records fail before React can render them', () => {
  for (const symbolicReadings of [undefined, null, {}, '', 1, [null], [false], [[]], [{ title: {} }], Array.from({ length: 4 }, reflection)]) {
    assert.throws(() => parseSymbolicResponse({ ...response(), symbolicReadings }, true));
  }
  for (const [field, value] of [
    ['excerpt', 'Not in the passage'], ['excerpt', ''], ['title', {}], ['title', ' '], ['reading', null],
    ['reflectionQuestion', []], ['basis', 'supported'], ['tradition', 'Uncited tradition'], ['sources', {}], ['sources', [null]],
  ]) assert.throws(() => parseSymbolicResponse(response({ ...reflection(), [field]: value }), true), field);
  for (const item of [tradition(), { ...tradition(), tradition: ' ' }]) {
    item.sources = [];
    assert.throws(() => parseSymbolicResponse(response(item), true));
  }
  assert.throws(() => parseSymbolicResponse(response({ ...reflection(), sources: tradition().sources }), true));
});

test('symbolic citation records accept only safe HTTP links and the bounded server shape', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://secret:token@example.org/', 'file:///private', '/relative', null, {}]) {
    assert.throws(() => parseSymbolicResponse(response({ ...tradition(), sources: [{ title: 'Bad source', url }] }), true));
  }
  for (const source of [null, [], {}, { url: 'https://example.org', title: {} }, { url: 'https://example.org' }]) {
    assert.throws(() => parseSymbolicResponse(response({ ...tradition(), sources: [source] }), true));
  }
  assert.throws(() => parseSymbolicResponse(response({ ...tradition(), sources: Array.from({ length: 9 }, () => tradition().sources[0]) }), true));
  const legacyHttp = { ...tradition(), sources: [{ title: '', url: 'http://example.org/source' }] };
  assert.deepEqual(parseSymbolicResponse(response(legacyHttp), true).symbolicReadings[0], legacyHttp);
});
