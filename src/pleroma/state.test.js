import test from 'node:test';
import assert from 'node:assert/strict';
import { explorerSearch, readExplorerRoute } from './state.js';

const noOverlays = { paired: false, planets: false, torus: false };

test('empty links retain analyzer entry and use the caller’s responsive mode default', () => {
  assert.deepEqual(readExplorerRoute(''), {
    view: 'analyze', tradition: 'john', node: null, mode: '3d', overlays: noOverlays,
  });
  assert.equal(readExplorerRoute('?view=pleroma', '2d').mode, '2d');
  assert.equal(readExplorerRoute('?view=pleroma&mode=3d', '2d').mode, '3d');
});

test('a shared deep link restores its selected entity, rendering mode, and supported overlays', () => {
  assert.deepEqual(readExplorerRoute('?view=pleroma&tradition=john&node=sophia&mode=2d&overlays=paired,planets'), {
    view: 'pleroma', tradition: 'john', node: 'sophia', mode: '2d',
    overlays: { paired: true, planets: true, torus: false },
  });
});

test('malformed route fields fall back safely without accepting arbitrary node syntax', () => {
  const route = readExplorerRoute('?view=unknown&tradition=unknown&mode=unknown', '2d');
  assert.equal(route.view, 'analyze');
  assert.equal(route.tradition, 'john');
  assert.equal(route.mode, '2d');
  for (const value of ['', 'Sophia', 'sophia cloud', 'john/sophia', '<script>', 'x'.repeat(81)]) {
    assert.equal(readExplorerRoute('?view=pleroma&node=' + encodeURIComponent(value)).node, null, value);
  }
  // Syntactically valid IDs are resolved against the lazy-loaded catalog by the explorer.
  assert.equal(readExplorerRoute('?view=pleroma&node=unrecognized-entity').node, 'unrecognized-entity');
});

test('overlays cannot leak across traditions or enable unknown interpretations', () => {
  const expected = {
    john: { paired: true, planets: true, torus: false },
    ezekiel: { paired: false, planets: false, torus: true },
    tree: noOverlays,
    plotinus: noOverlays,
  };
  for (const [tradition, overlays] of Object.entries(expected)) {
    const query = `?view=pleroma&tradition=${tradition}&overlays=paired,planets,torus,unknown,paired`;
    assert.deepEqual(readExplorerRoute(query).overlays, overlays, tradition);
    const serialized = explorerSearch('', {
      view: 'pleroma', tradition, node: null, mode: '3d',
      overlays: { paired: true, planets: true, torus: true, unknown: true },
    });
    assert.deepEqual(readExplorerRoute(serialized).overlays, overlays, tradition);
    assert.ok(!new URLSearchParams(serialized).get('overlays')?.includes('unknown'));
  }
});

test('serialization round-trips independent history entries for every tradition', () => {
  const entries = [
    { view: 'pleroma', tradition: 'john', node: 'sophia', mode: '3d', overlays: { ...noOverlays, paired: true } },
    { view: 'pleroma', tradition: 'ezekiel', node: 'throne', mode: '2d', overlays: { ...noOverlays, torus: true } },
    { view: 'pleroma', tradition: 'tree', node: 'keter', mode: '3d', overlays: { ...noOverlays } },
    { view: 'pleroma', tradition: 'plotinus', node: 'one', mode: '2d', overlays: { ...noOverlays } },
  ];
  const links = [];
  let search = '?campaign=atlas';
  for (const entry of entries) {
    search = explorerSearch(search, entry);
    links.push(search);
  }
  // Parsing older links after later navigation must restore the older state, not the latest selection.
  for (let index = entries.length - 1; index >= 0; index--) {
    assert.deepEqual(readExplorerRoute(links[index]), entries[index]);
    assert.equal(new URLSearchParams(links[index]).get('campaign'), 'atlas');
  }
  const first = readExplorerRoute(links[0]);
  const again = readExplorerRoute(links[0]);
  first.overlays.paired = false;
  assert.equal(again.overlays.paired, true);
});

test('feature navigation preserves unrelated query parameters, including repeated and Unicode values', () => {
  const initial = '?campaign=atlas&filter=one&filter=two&label=' + encodeURIComponent('עולם & κόσμος') + '&return=%2Fadmin%2F';
  const search = explorerSearch(initial, {
    view: 'pleroma', tradition: 'john', node: 'barbelo', mode: '3d', overlays: noOverlays,
  });
  const params = new URLSearchParams(search);
  assert.equal(params.get('campaign'), 'atlas');
  assert.deepEqual(params.getAll('filter'), ['one', 'two']);
  assert.equal(params.get('label'), 'עולם & κόσμος');
  assert.equal(params.get('return'), '/admin/');
});

test('returning to Analyze removes only the explorer’s parameters', () => {
  const search = explorerSearch('?view=pleroma&tradition=john&node=sophia&mode=3d&overlays=paired&campaign=atlas&filter=one&filter=two', { view: 'analyze' });
  const params = new URLSearchParams(search);
  for (const key of ['view', 'tradition', 'node', 'mode', 'overlays']) assert.equal(params.has(key), false, key);
  assert.deepEqual([...params], [['campaign', 'atlas'], ['filter', 'one'], ['filter', 'two']]);
  assert.equal(explorerSearch('?view=pleroma&node=sophia', { view: 'analyze' }), '');
});

test('the closed-inspector sentinel survives reloads and remains distinct from an unspecified selection', () => {
  const closed = {
    view: 'pleroma', tradition: 'john', node: 'none', mode: '2d', overlays: noOverlays,
  };
  const serialized = explorerSearch('', closed);
  assert.equal(new URLSearchParams(serialized).get('node'), 'none');
  assert.deepEqual(readExplorerRoute(serialized), closed);
  assert.equal(readExplorerRoute('?view=pleroma&tradition=john').node, null);
});

test('serialization rejects unsafe identifiers and unsupported view or mode values', () => {
  const search = explorerSearch('', {
    view: 'pleroma', tradition: 'not-a-tradition', node: 'sophia<script>', mode: 'webxr', overlays: noOverlays,
  });
  const parsed = readExplorerRoute(search);
  assert.equal(parsed.tradition, 'john');
  assert.equal(parsed.node, null);
  assert.equal(parsed.mode, '3d');
  assert.equal(explorerSearch('?view=pleroma&mode=3d', { view: 'unknown' }), '');
});

test('a malformed tradition normalizes consistently when reading and writing a link', () => {
  const incoming = readExplorerRoute('?view=pleroma&tradition=unknown&node=barbelo&mode=2d&overlays=paired,planets,torus');
  const rewritten = explorerSearch('', {
    view: 'pleroma', tradition: 'unknown', node: 'barbelo', mode: '2d',
    overlays: { paired: true, planets: true, torus: true },
  });
  assert.deepEqual(readExplorerRoute(rewritten), incoming);
});
