import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnotations, withFindingLinks } from './annotations.js';

const cited = [{ title: 'Evidence', url: 'https://example.org/evidence' }];

test('repeated short excerpts keep all highlights but bound commentary links to forty findings', () => {
  const source = 'a '.repeat(15_000);
  const result = {
    claims: Array.from({ length: 20 }, () => ({ excerpt: 'a', status: 'supported', sources: cited })),
    rhetoric: Array.from({ length: 20 }, () => ({ excerpt: 'a', explanation: 'Possible framing.', isReasoningFlaw: false })),
  };
  const segments = withFindingLinks(buildAnnotations(source, result));
  assert.equal(segments.map((segment) => segment.text).join(''), source);
  assert.equal(segments.filter((segment) => segment.tone === 'supported').length, 15_000);
  assert.equal(segments.reduce((count, segment) => count + segment.links.length, 0), 40);
  assert.equal(new Set(segments.flatMap((segment) => segment.links.map((finding) => finding.id))).size, 40);
});

function checkLossless(source, segments) {
  assert.equal(segments.map((segment) => segment.text).join(''), source);
  let cursor = 0;
  for (const segment of segments) {
    assert.equal(segment.start, cursor);
    assert.equal(segment.text, source.slice(segment.start, segment.end));
    assert.ok(segment.end > segment.start);
    cursor = segment.end;
  }
  assert.equal(cursor, source.length);
}

test('annotations preserve unmarked text and ignore empty or unmatched excerpts', () => {
  const source = 'An ordinary passage.\n  Another line.';
  const result = {
    claims: [{ excerpt: '', status: 'supported', sources: cited }, { excerpt: 'Not in the source', status: 'supported', sources: cited }],
    rhetoric: [{ excerpt: '   ', isReasoningFlaw: true, explanation: 'Blank.' }, null],
  };
  const segments = buildAnnotations(source, result);
  assert.deepEqual(segments, [{ text: source, start: 0, end: source.length, tone: null, findings: [] }]);
  checkLossless(source, segments);
  assert.deepEqual(buildAnnotations('', result), []);
  assert.deepEqual(buildAnnotations(null, result), []);
  assert.deepEqual(buildAnnotations(source, null), segments);
});

test('annotations mark every repeated occurrence with stable finding IDs', () => {
  const source = 'The Moon orbits Earth. Again: The Moon orbits Earth.';
  const excerpt = 'The Moon orbits Earth.';
  const segments = buildAnnotations(source, { claims: [{ excerpt, status: 'supported', sources: cited }] });
  assert.deepEqual(segments.map(({ text, tone }) => ({ text, tone })), [
    { text: excerpt, tone: 'supported' },
    { text: ' Again: ', tone: null },
    { text: excerpt, tone: 'supported' },
  ]);
  assert.deepEqual(segments[0].findings, [{ id: 'claim-0', kind: 'claim', index: 0, labelKey: 'supported' }]);
  assert.deepEqual(segments[2].findings, segments[0].findings);
  checkLossless(source, segments);
});

test('overlaps combine findings and problem tone takes precedence over supported and neutral', () => {
  const source = 'A claim with blame.';
  const segments = buildAnnotations(source, {
    claims: [
      { excerpt: source, status: 'supported', sources: cited },
      { excerpt: 'with blame', status: 'unverified', sources: [] },
    ],
    rhetoric: [{ excerpt: 'blame', isReasoningFlaw: true, explanation: 'Blame is assigned without support.' }],
  });
  assert.deepEqual(segments.map(({ text, tone, findings }) => ({ text, tone, ids: findings.map(({ id }) => id) })), [
    { text: 'A claim ', tone: 'supported', ids: ['claim-0'] },
    { text: 'with ', tone: 'supported', ids: ['claim-0', 'claim-1'] },
    { text: 'blame', tone: 'problem', ids: ['claim-0', 'claim-1', 'rhetoric-0'] },
    { text: '.', tone: 'supported', ids: ['claim-0'] },
  ]);
  assert.equal(segments[2].findings[2].labelKey, 'reasoningFailure');
  checkLossless(source, segments);
});

test('self-overlapping occurrences do not duplicate or prematurely remove a finding', () => {
  const segments = buildAnnotations('aaaaa!', { claims: [{ excerpt: 'aaa', status: 'supported', sources: cited }] });
  assert.equal(segments.length, 2);
  assert.equal(segments[0].text, 'aaaaa');
  assert.equal(segments[0].findings.length, 1);
  assert.equal(segments[1].text, '!');
  checkLossless('aaaaa!', segments);
});

test('claim tones require evidence and ordinary rhetorical observations stay neutral', () => {
  const source = 'one two three four five six seven';
  const segments = buildAnnotations(source, {
    claims: [
      { excerpt: 'one', status: 'supported', sources: [] },
      { excerpt: 'two', status: 'contradicted', sources: cited },
      { excerpt: 'three', status: 'mixed', sources: cited },
      { excerpt: 'four', status: 'unverified', sources: cited },
      { excerpt: 'five', status: 'unknown', sources: cited },
    ],
    rhetoric: [
      { excerpt: 'six', isReasoningFlaw: true, explanation: '  ' },
      { excerpt: 'seven', isReasoningFlaw: false, explanation: 'A rhetorical observation.' },
    ],
  }).filter((segment) => segment.findings.length);
  assert.deepEqual(segments.map(({ tone }) => tone), ['neutral', 'problem', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral']);
  assert.deepEqual(segments.map(({ findings }) => findings[0].labelKey), [
    'supported', 'contradicted', 'mixed', 'unverified', 'unverified', 'rhetoricalObservation', 'rhetoricalObservation',
  ]);
});

test('Hebrew combining marks, Russian and emoji keep exact source offsets without normalization', () => {
  const source = 'שָׁלוֹם — Мир 🌍. שלום';
  const excerpt = 'שָׁלוֹם';
  const segments = buildAnnotations(source, {
    claims: [{ excerpt, status: 'supported', sources: cited }, { excerpt: 'Мир 🌍', status: 'mixed', sources: [] }],
    rhetoric: [{ excerpt: 'שָלוֹם', isReasoningFlaw: true, explanation: 'A different sequence of marks does not match.' }],
  });
  assert.equal(segments[0].text, excerpt);
  assert.equal(segments[0].end, excerpt.length);
  assert.deepEqual(segments.flatMap(({ findings }) => findings.map(({ id }) => id)), ['claim-0', 'claim-1']);
  checkLossless(source, segments);
});

test('markup-like text remains literal content for the React renderer to escape', () => {
  const source = '<script>alert("x")</script> & <b>claim</b>';
  const segments = buildAnnotations(source, {
    rhetoric: [{ excerpt: '<script>alert("x")</script>', isReasoningFlaw: true, explanation: 'An observed passage.' }],
  });
  assert.equal(segments[0].text, '<script>alert("x")</script>');
  assert.equal(segments[0].tone, 'problem');
  checkLossless(source, segments);
});
