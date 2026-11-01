import test from 'node:test';
import assert from 'node:assert/strict';
import { languages, messages, translate, savedLanguage, localeStorageKey } from './i18n.js';

test('all interface locales have the same nonempty messages and interpolation fields', () => {
  const keys = Object.keys(messages.en).sort();
  for (const language of languages) {
    assert.deepEqual(Object.keys(messages[language]).sort(), keys);
    for (const key of keys) {
      assert.equal(typeof messages[language][key], 'string');
      assert.ok(messages[language][key].trim(), `${language}: ${key}`);
      assert.deepEqual(messages[language][key].match(/\{\w+\}/g), messages.en[key].match(/\{\w+\}/g));
    }
  }
  assert.match(translate('he', 'analysis'), /[\u0590-\u05ff]/);
  assert.match(translate('ru', 'analysis'), /[\u0400-\u04ff]/);
  assert.equal(translate('en', 'findingLink', { label: 'Supported', number: 2 }), 'Supported, finding 2');
});

test('locale persistence accepts only supported locales and tolerates disabled storage', () => {
  for (const language of languages) assert.equal(savedLanguage({ getItem: (key) => { assert.equal(key, localeStorageKey); return language; } }), language);
  for (const value of [null, '', 'fr', 'HE', '<script>']) assert.equal(savedLanguage({ getItem: () => value }), 'en');
  assert.equal(savedLanguage({ getItem: () => { throw new Error('Storage disabled'); } }), 'en');
});
