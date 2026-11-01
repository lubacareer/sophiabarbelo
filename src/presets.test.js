import test from 'node:test';
import assert from 'node:assert/strict';
import { presets } from './presets.js';

test('every demo can be loaded in all three UI languages with provenance', () => {
  assert.equal(new Set(presets.map(({ id }) => id)).size, 4);
  assert.equal(presets.filter(({ group }) => group === 'ancient').length, 3);
  assert.equal(presets.filter(({ group }) => group === 'media').length, 1);
  for (const preset of presets) {
    assert.deepEqual(Object.keys(preset.locales).sort(), ['en', 'he', 'ru']);
    assert.ok(['excerpt', 'adaptation'].includes(preset.kind));
    assert.ok(preset.reference);
    assert.ok(preset.sources.length > 0);
    for (const source of preset.sources) {
      assert.ok(source.title);
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.username + url.password, '');
    }
    for (const locale of Object.values(preset.locales)) {
      for (const field of ['title', 'description', 'text', 'attribution']) {
        assert.equal(typeof locale[field], 'string');
        assert.ok(locale[field].trim().length > 0, `${preset.id}: missing ${field}`);
      }
      assert.ok(locale.text.length <= 30_000);
      assert.ok(!locale.text.includes('\uFFFD'), `${preset.id}: damaged Unicode`);
    }
  }
});

test('Job’s friends remain three separately attributed passages in each language', () => {
  const preset = presets.find(({ id }) => id === 'job-friends');
  assert.equal(preset.kind, 'excerpt');
  for (const locale of Object.values(preset.locales)) {
    const passages = locale.text.split('\n\n');
    assert.equal(passages.length, 3);
    assert.match(passages[0].split('\n')[0], /4:7–9$/u);
    assert.match(passages[1].split('\n')[0], /8:3–6$/u);
    assert.match(passages[2].split('\n')[0], /11:5–6$/u);
  }
  assert.match(preset.locales.en.attribution, /public-domain/u);
  assert.match(preset.locales.en.attribution, /opening quotation mark.*omitted/u);
  const [firstEnglishPassage] = preset.locales.en.text.split('\n\n');
  assert.doesNotMatch(firstEnglishPassage, /Job 4:7–9\s*["“]/u);
  assert.equal((firstEnglishPassage.match(/“/gu) || []).length, (firstEnglishPassage.match(/”/gu) || []).length);
  assert.match(preset.locales.he.attribution, /ברשות הציבור/u);
  assert.match(preset.locales.ru.attribution, /общественное достояние/u);
});

test('adapted demos identify themselves instead of impersonating source quotations', () => {
  for (const preset of presets.filter(({ kind }) => kind === 'adaptation')) {
    assert.match(preset.locales.en.attribution, /adaptation.*not.*quotation/u);
    assert.match(preset.locales.he.attribution, /עיבוד.*לא ציטוט/u);
    assert.match(preset.locales.ru.attribution, /адаптация.*не цитата/u);
  }
});

test('the media adaptation keeps its historical date and the old-video distinction', () => {
  const preset = presets.find(({ id }) => id === 'viral-hospital-photos');
  assert.match(preset.reference, /2026-10-22/u);
  for (const locale of Object.values(preset.locales)) {
    assert.match(locale.text, /2026/u);
    assert.match(locale.text, /2011/u);
  }
  assert.match(preset.locales.en.text, /without conclusive forensic proof/u);
  assert.match(preset.locales.he.text, /ללא הוכחה פורנזית מכרעת/u);
  assert.match(preset.locales.ru.text, /не дали окончательного экспертного доказательства/u);
});

test('presets supply inputs and provenance without predetermined model findings', () => {
  const forbidden = /^(?:expected|verdict|status|claims|rhetoric|category|categories|results?)/iu;
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
      assert.equal(forbidden.test(key), false, `Unexpected model-guiding field: ${key}`);
      visit(nested);
    }
  };
  visit(presets);
  for (const preset of presets) {
    assert.doesNotMatch(preset.locales.en.description, /gaslighting|intimidation|smearing|false narrative/iu);
  }
});
