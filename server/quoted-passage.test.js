import test from 'node:test';
import assert from 'node:assert/strict';
import { presets } from '../src/presets.js';
import { analyzeWithGroq } from './groq.js';
import { analyzeWithGrok } from './grok.js';
import { passageAnalysisInstruction } from './analysis-instruction.js';

const empty = { claims: [], rhetoric: [], limitations: [] };
const source = 'https://example.org/source';

// These tests inspect requests and validation with stubbed provider output;
// they do not claim that a model will always produce a particular interpretation.
async function runGroq(text, language, output = empty) {
  const requests = [];
  const result = await analyzeWithGroq(text, { apiKey: 'test', language, fetchImpl: async (_url, options) => {
    requests.push(JSON.parse(options.body));
    const message = requests.length === 1
      ? { content: 'Research evidence', executed_tools: [{ search_results: { results: [{ url: source }] } }] }
      : { content: JSON.stringify(output) };
    return { ok: true, json: async () => ({ choices: [{ message }] }) };
  } });
  return { requests, result };
}

async function runGrok(text, language, output = empty) {
  let request;
  const result = await analyzeWithGrok(text, { apiKey: 'test', language, fetchImpl: async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ citations: [source], output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }) };
  } });
  return { request, result };
}

test('both providers receive substantive-passage guidance in every model stage without injected preset findings', async () => {
  const preset = presets.find(({ id }) => id === 'job-friends');
  const examples = [
    ...['en', 'he', 'ru'].map((language) => ({ language, text: preset.locales[language].text })),
    { language: 'en', text: 'A historian wrote: “The meeting began at noon.”' },
    { language: 'en', text: 'This quotation accurately reproduces the original: “The meeting began at noon.”' },
  ];

  for (const { text, language } of examples) {
    const groq = await runGroq(text, language);
    const grok = await runGrok(text, language);
    assert.equal(groq.requests.length, 2);
    for (const prompt of [groq.requests[0].messages[0].content, groq.requests[1].messages[0].content, grok.request.input[0].content]) {
      assert.ok(prompt.includes(passageAnalysisInstruction), 'each stage must receive the shared guidance');
      assert.match(prompt, /substantive assertions, reasoning, and rhetorical choices/i);
      assert.match(prompt, /source reference alone does not assert that the quotation is accurate/i);
      assert.match(prompt, /quotation fidelity only when the input explicitly asserts or requests it/i);
      assert.match(prompt, /empirically checkable assertions from theological or moral positions/i);
      assert.match(prompt, /lack of evidence alone does not establish the opposite/i);
      assert.match(prompt, /do not equate its account with independent evidence/i);
      assert.match(prompt, /do not force a finding or presume intent/i);
    }
    assert.equal(groq.requests[0].messages[1].content, text);
    const structuredInput = JSON.parse(groq.requests[1].messages[1].content);
    assert.deepEqual(Object.keys(structuredInput).sort(), ['originalText', 'providerReportedUrls', 'research']);
    assert.equal(structuredInput.originalText, text);
    assert.equal(grok.request.input[1].content, text);
    assert.deepEqual(groq.result, empty);
    assert.deepEqual(grok.result, empty);
  }
});

test('an explicitly asserted quotation-fidelity claim can retain evidence in either provider', async () => {
  const text = 'The pamphlet claims: “This quotation accurately reproduces the original.”';
  const excerpt = 'This quotation accurately reproduces the original.';
  const output = { claims: [{ excerpt, claim: excerpt, status: 'supported', explanation: 'A source comparison supports the claim.', sources: [{ title: 'Source', url: source }] }], rhetoric: [], limitations: [] };
  for (const { result } of [await runGroq(text, 'en', output), await runGrok(text, 'en', output)]) {
    assert.equal(result.claims[0].status, 'supported');
    assert.equal(result.claims[0].excerpt, excerpt);
    assert.deepEqual(result.claims[0].sources, [{ title: 'Source', url: source }]);
    assert.deepEqual(result.rhetoric, []);
  }
});

test('quoted Unicode excerpts stay exact and invented citations do not support claims', async () => {
  const text = 'דובר: ״כָּל אָדָם סוֹבֵל בְּאַשְׁמָתוֹ״. Говорящий: «Каждый страдает по своей вине». ';
  const hebrew = 'כָּל אָדָם סוֹבֵל בְּאַשְׁמָתוֹ';
  const russian = 'Каждый страдает по своей вине';
  const output = {
    claims: [{ excerpt: hebrew, claim: 'Suffering proves fault', status: 'supported', explanation: 'Alleged support.', sources: [{ title: 'Invented', url: 'https://example.org/not-reported' }] }],
    rhetoric: [{ excerpt: russian, category: 'Риторика', categoryId: 'victim_blaming', isReasoningFlaw: false, explanation: 'Возможная интерпретация.' }],
    limitations: [],
  };
  for (const { result } of [await runGroq(text, 'ru', output), await runGrok(text, 'ru', output)]) {
    assert.equal(result.claims[0].excerpt, hebrew);
    assert.equal(result.claims[0].status, 'unverified');
    assert.deepEqual(result.claims[0].sources, []);
    assert.equal(result.rhetoric[0].excerpt, russian);
    assert.equal(result.rhetoric[0].isReasoningFlaw, false);
  }
});
