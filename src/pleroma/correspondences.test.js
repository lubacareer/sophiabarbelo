import test from 'node:test';
import assert from 'node:assert/strict';
import { getTradition } from './catalog.js';
import { correspondencePaths, celestialAssociations, correspondenceSources, correspondenceSymbols, getCorrespondence, correspondenceLabel } from './correspondences.js';

test('the 1909 Hermetic lens has exactly twenty-two distinct, sourced Tree paths', () => {
  const ids = new Set(getTradition('tree').nodes.map(({ id }) => id));
  assert.equal(correspondencePaths.length, 22);
  assert.deepEqual(correspondencePaths.map(({ order }) => order), Array.from({ length: 22 }, (_, index) => index + 11));
  assert.equal(new Set(correspondencePaths.map(({ letter }) => letter)).size, 22);
  assert.equal(new Set(correspondencePaths.map(({ from, to }) => [from, to].sort().join(':'))).size, 22);
  for (const path of correspondencePaths) {
    assert.ok(ids.has(path.from) && ids.has(path.to));
    assert.notEqual(path.from, path.to);
    assert.equal(getCorrespondence(path.id), path);
  }
  assert.equal(getCorrespondence('hermetic-path-15').tarotId, 'tarot-emperor');
  assert.equal(getCorrespondence('hermetic-path-15').astrologyId, 'zodiac-aries');
  assert.equal(getCorrespondence('hermetic-path-28').tarotId, 'tarot-star');
  assert.equal(getCorrespondence('hermetic-path-28').astrologyId, 'zodiac-aquarius');
  assert.equal(getCorrespondence('hermetic-path-19').astrologyId, 'zodiac-leo');
  assert.equal(getCorrespondence('hermetic-path-22').astrologyId, 'zodiac-libra');
  for (const [kind, count] of [['planet', 7], ['zodiac', 12], ['element', 3]]) {
    assert.equal(correspondencePaths.filter(({ astrology }) => astrology.kind === kind).length, count);
  }
});

test('every correspondence has localized exploration text and its own edition reference', () => {
  for (const record of [...correspondencePaths, ...celestialAssociations]) {
    for (const field of ['label', 'summary', 'interpretation', 'system']) {
      for (const language of ['en', 'he', 'ru']) assert.ok(record[field][language]?.trim(), `${record.id}/${field}/${language}`);
    }
    for (const id of record.sourceIds) {
      const source = correspondenceSources[id];
      assert.ok(source?.excerpt.trim());
      assert.match(source.reference, /Key scale .*columns/u);
      assert.equal(source.title, '777 (1909)');
      assert.equal(new URL(source.url).protocol, 'https:');
    }
  }
  assert.equal(celestialAssociations.length, 10);
  assert.equal(new Set(celestialAssociations.map(({ parentId }) => parentId)).size, 10);
  assert.equal(celestialAssociations.find(({ parentId }) => parentId === 'binah').symbolId, 'planet-saturn');
  assert.equal(celestialAssociations.find(({ parentId }) => parentId === 'yesod').symbolId, 'planet-moon');
  assert.equal(getCorrespondence('missing'), undefined);
});

test('the personal palette provides distinct Tarot, zodiac, and planetary symbols', () => {
  assert.equal(correspondenceSymbols.length, 41);
  assert.equal(new Set(correspondenceSymbols.map(({ id }) => id)).size, 41);
  for (const [kind, count] of [['tarot', 22], ['zodiac', 12], ['planet', 7]]) {
    assert.equal(correspondenceSymbols.filter((item) => item.kind === kind).length, count);
  }
  for (const item of correspondenceSymbols) for (const language of ['en', 'he', 'ru']) assert.ok(item.label[language]);
});

test('correspondence labels follow the selected Tarot and astrology facets', () => {
  const emperor = getCorrespondence('hermetic-path-15');
  assert.equal(correspondenceLabel(emperor, 'en', { tarot: true }), 'The Emperor');
  assert.equal(correspondenceLabel(emperor, 'en', { astrology: true }), 'Aries');
  assert.equal(correspondenceLabel(emperor, 'he', { tarot: true, astrology: true }), 'הקיסר · טלה');
  assert.equal(correspondenceLabel(celestialAssociations[2], 'ru', { astrology: true }), 'Сатурн');
});
