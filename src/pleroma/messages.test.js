import test from 'node:test';
import assert from 'node:assert/strict';
import { messages, t } from './messages.js';

const placeholderNames = (value) => [...value.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]).sort();

test('all three interface languages cover the same nonempty UI copy and placeholders', () => {
  assert.deepEqual(Object.keys(messages).sort(), ['en', 'he', 'ru']);
  const keys = Object.keys(messages.en).sort();
  for (const [language, copy] of Object.entries(messages)) {
    assert.deepEqual(Object.keys(copy).sort(), keys, `${language}: missing or extra interface copy`);
    for (const key of keys) {
      assert.equal(typeof copy[key], 'string', `${language}: ${key}`);
      assert.ok(copy[key].trim(), `${language}: empty ${key}`);
      assert.ok(!copy[key].includes('\uFFFD'), `${language}: damaged Unicode in ${key}`);
      assert.deepEqual(placeholderNames(copy[key]), placeholderNames(messages.en[key]), `${language}: ${key} placeholders`);
    }
    assert.notEqual(copy.source, copy.interpretation, `${language}: source and editorial interpretation must remain distinct`);
    assert.deepEqual(copy.pairedExplanation.match(/\d+/gu), ['12', '24'], `${language}: sourced entity and visual aspect counts`);
  }
  assert.match(messages.he.subtitle, /\p{Script=Hebrew}/u);
  assert.match(messages.ru.subtitle, /\p{Script=Cyrillic}/u);
});

test('interpolation keeps names verbatim in every locale and ignores inherited replacements', () => {
  const name = 'Σοφία / חכמה / София $&';
  for (const language of Object.keys(messages)) {
    const rendered = t(language, 'aspectsLabel', { name });
    assert.ok(rendered.includes(name), language);
    assert.ok(!rendered.includes('{name}'), language);
    assert.ok(t(language, 'aspectsLabel').includes('{name}'), `${language}: omitted value remains explicit`);
    const inherited = Object.create({ name: 'Not an explicit replacement' });
    assert.ok(t(language, 'aspectsLabel', inherited).includes('{name}'), `${language}: inherited value ignored`);
  }
});

test('unsupported languages and unknown keys have predictable readable fallbacks', () => {
  assert.equal(t('unknown', 'navAnalyze'), messages.en.navAnalyze);
  assert.equal(t(undefined, 'source'), messages.en.source);
  assert.equal(t('he', 'missingInterfaceKey'), 'missingInterfaceKey');
  assert.equal(t('unknown', 'aspectsLabel', { name: 'Sophia' }), t('en', 'aspectsLabel', { name: 'Sophia' }));
});
