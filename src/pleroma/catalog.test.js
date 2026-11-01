import test from 'node:test';
import assert from 'node:assert/strict';
import { getNode, getTradition, localize, planetaryNodes, planetarySourceId, sources, traditions } from './catalog.js';

const languages = ['en', 'he', 'ru'];
const normalizedWhitespace = (value) => value.replace(/\s+/gu, ' ').trim();
const undirected = (from, to) => [from, to].sort().join(' / ');

test('each tradition has distinct entities, valid connections, usable layers, and a documented default selection', () => {
  assert.deepEqual(traditions.map(({ id }) => id).sort(), ['ezekiel', 'john', 'plotinus', 'tree']);
  for (const tradition of traditions) {
    const ids = new Set(tradition.nodes.map(({ id }) => id));
    assert.equal(ids.size, tradition.nodes.length, `${tradition.id}: duplicate entity IDs`);
    assert.ok(ids.has(tradition.defaultNode), `${tradition.id}: missing default selection`);
    const layers = new Set(tradition.layers.map(({ id }) => id));
    assert.equal(layers.size, tradition.layers.length, `${tradition.id}: duplicate layers`);
    const edges = new Set();
    for (const edge of tradition.edges) {
      assert.ok(ids.has(edge.from) && ids.has(edge.to), `${tradition.id}: missing connection endpoint`);
      assert.notEqual(edge.from, edge.to, `${tradition.id}: self connection`);
      assert.ok(['textual', 'schematic'].includes(edge.kind));
      const key = undirected(edge.from, edge.to);
      assert.ok(!edges.has(key), `${tradition.id}: duplicate connection ${key}`);
      edges.add(key);
    }
    for (const node of tradition.nodes) {
      assert.ok(/^[a-z0-9-]{1,80}$/u.test(node.id), `${tradition.id}: entity cannot be deep-linked`);
      assert.ok(layers.has(node.layer), `${tradition.id}/${node.id}: missing layer`);
      assert.ok(node.sourceIds.length > 0, `${tradition.id}/${node.id}: missing primary source`);
      for (const sourceId of node.sourceIds) assert.ok(sources[sourceId], `${tradition.id}/${node.id}: unknown source ${sourceId}`);
    }
  }
});

test('labels, summaries, and editorial explanations cover English, Hebrew, and Russian', () => {
  for (const tradition of traditions) {
    const localized = [tradition.title, ...tradition.layers.map(({ label }) => label),
      ...tradition.nodes.flatMap(({ label, summary, interpretation }) => [label, summary, interpretation])];
    for (const copy of localized) {
      for (const language of languages) {
        assert.equal(typeof copy[language], 'string', `${tradition.id}: missing ${language} copy`);
        assert.ok(copy[language].trim(), `${tradition.id}: empty ${language} copy`);
        assert.ok(!copy[language].includes('\uFFFD'), `${tradition.id}: damaged Unicode`);
      }
    }
  }
  for (const node of planetaryNodes) for (const field of ['label', 'summary', 'interpretation']) {
    for (const language of languages) assert.ok(node[field][language]?.trim(), `${node.id}: ${field}/${language}`);
  }
  assert.equal(localize({ en: 'English fallback' }, 'unknown'), 'English fallback');
  assert.equal(localize('Untranslated source title', 'he'), 'Untranslated source title');
});

test('source records retain exact excerpt text within context and explicit reusable-edition provenance', () => {
  for (const [id, source] of Object.entries(sources)) {
    for (const field of ['title', 'witness', 'reference', 'language', 'excerpt', 'context', 'translator', 'rights', 'rightsUrl', 'url']) {
      assert.equal(typeof source[field], 'string', `${id}: ${field}`);
      assert.ok(source[field].trim(), `${id}: empty ${field}`);
    }
    assert.ok(normalizedWhitespace(source.context).includes(normalizedWhitespace(source.excerpt)), `${id}: excerpt changed from its bundled context`);
    assert.match(source.rights, /public.domain|CC0/iu, `${id}: expected an explicitly reusable selected edition`);
    assert.match(source.snapshot, /^\d{4}-\d{2}-\d{2}$/u, `${id}: missing snapshot date`);
    for (const field of ['url', 'rightsUrl', ...(source.sourceDataUrl ? ['sourceDataUrl'] : [])]) {
      const url = new URL(source[field]);
      assert.equal(url.protocol, 'https:', `${id}: unsafe ${field}`);
      assert.equal(url.username + url.password, '', `${id}: embedded credentials`);
    }
    if (source.language === 'arc') {
      assert.equal(source.direction, 'rtl', `${id}: Aramaic reading direction`);
      assert.equal(source.witness, 'Tikkunei Zohar - Vocalized', `${id}: avoid substituting a differently licensed default edition`);
      assert.equal(new URL(source.sourceDataUrl).searchParams.get('vhe'), 'Tikkunei Zohar - Vocalized');
    }
  }
  const john = getTradition('john');
  for (const id of new Set(john.nodes.flatMap(({ sourceIds }) => sourceIds))) {
    assert.match(sources[id].witness, /NHC II,1/u);
    assert.match(sources[id].translator, /Samuel Zinner.*Mark Mattison/u);
    assert.equal(sources[id].sourceDataUrl, 'https://othergospels.com/john/zinner.json');
  }
  assert.ok(sources['john-barbelo'].excerpt.includes('[is the Providence of the All]'), 'preserve restoration brackets in the source text');
});

test('John retains four Luminaries and twelve sourced aeons, with Sophia counted once', () => {
  const john = getTradition('john');
  const lights = john.nodes.filter(({ kind }) => kind === 'luminary');
  const aeons = john.nodes.filter(({ kind }) => kind === 'aeon');
  assert.deepEqual(lights.map(({ id }) => id).sort(), ['armozel', 'daveithai', 'eleleth', 'oriael']);
  assert.equal(aeons.length, 12);
  const expected = {
    armozel: ['form', 'grace', 'truth'],
    oriael: ['memory', 'perception', 'reflection'],
    daveithai: ['ideal-form', 'love', 'understanding'],
    eleleth: ['peace', 'perfection', 'sophia'],
  };
  for (const [group, ids] of Object.entries(expected)) {
    assert.deepEqual(aeons.filter((node) => node.group === group).map(({ id }) => id).sort(), ids);
  }
  assert.equal(john.nodes.filter(({ id }) => id === 'sophia').length, 1);
  assert.equal(getNode(john, 'sophia').kind, 'aeon');
  assert.equal(john.nodes.filter(({ kind }) => kind === 'heaven').length, 7);
  assert.equal(john.nodes.filter(({ kind }) => kind === 'planet').length, 0);
  assert.ok(john.nodes.some(({ kind }) => kind === 'cloud'));
});

test('the Tree has ten numbered sefirot and only the thirteen approved schematic connections', () => {
  const tree = getTradition('tree');
  assert.equal(tree.nodes.length, 10);
  assert.ok(tree.nodes.every(({ kind }) => kind === 'sefirah'));
  assert.deepEqual(tree.nodes.map(({ order }) => order).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(!tree.nodes.some(({ id }) => /da.?at/iu.test(id)));
  const byNumber = new Map(tree.nodes.map((node) => [node.order, node.id]));
  const pairs = [[1, 2], [1, 3], [1, 6], [2, 4], [3, 5], [4, 7], [5, 8], [4, 6], [5, 6], [6, 9], [7, 9], [8, 9], [9, 10]];
  const expected = pairs.map(([from, to]) => undirected(byNumber.get(from), byNumber.get(to))).sort();
  assert.deepEqual(tree.edges.map(({ from, to }) => undirected(from, to)).sort(), expected);
  assert.ok(tree.edges.every(({ kind }) => kind === 'schematic'));
});

test('Ezekiel and Plotinus preserve their own structures rather than inheriting the Gnostic model', () => {
  const ezekiel = getTradition('ezekiel');
  assert.equal(ezekiel.nodes.filter(({ kind }) => kind === 'wheel').length, 4);
  assert.equal(ezekiel.nodes.filter(({ kind }) => kind === 'creature').length, 4);
  for (const kind of ['throne', 'expanse', 'eyes']) assert.equal(ezekiel.nodes.filter((node) => node.kind === kind).length, 1);
  const plotinus = getTradition('plotinus');
  assert.deepEqual(plotinus.nodes.map(({ id }) => id), ['one', 'intellect', 'soul', 'cosmos']);
  assert.deepEqual(plotinus.edges.map(({ from, to }) => [from, to]), [['one', 'intellect'], ['intellect', 'soul'], ['soul', 'cosmos']]);
});

test('the seven classical planets are a separately sourced comparison, not Gnostic ruler identities', () => {
  assert.equal(planetarySourceId, 'cicero-planets');
  assert.deepEqual(planetaryNodes.map(({ label }) => label.en), ['Moon', 'Mercury', 'Venus', 'Sun', 'Mars', 'Jupiter', 'Saturn']);
  assert.equal(new Set(planetaryNodes.map(({ id }) => id)).size, 7);
  const johnIds = new Set(getTradition('john').nodes.map(({ id }) => id));
  for (const node of planetaryNodes) {
    assert.equal(node.kind, 'planet');
    assert.deepEqual(node.sourceIds, [planetarySourceId]);
    assert.ok(!johnIds.has(node.id));
    assert.equal(getNode('john', node.id), node);
    assert.equal(getNode('tree', node.id), undefined);
  }
  assert.match(sources[planetarySourceId].title, /Cicero|Republic|Scipio/iu);
  assert.match(sources[planetarySourceId].reference, /VI.?17|6.?17|\[17\]/u);
  assert.equal(getTradition('unknown'), getTradition('john'));
});
