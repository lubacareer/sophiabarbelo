import test from 'node:test';
import assert from 'node:assert/strict';
import { planetaryNodes, traditions, getTradition } from './catalog.js';
import { HEIGHT, WIDTH, curvePath, curvePoints, focusFor, getScene, pointOnCurve } from './geometry.js';

const finiteVector = (vector, length, label) => {
  assert.equal(vector.length, length, label);
  assert.ok(vector.every(Number.isFinite), label);
};

test('all map layouts are deterministic, finite, and keep selectable entities inside the logical canvas', () => {
  for (const tradition of traditions) {
    for (const overlays of [{}, { paired: true, planets: true, torus: true }]) {
      const scene = getScene(tradition, overlays);
      assert.deepEqual(scene, getScene(tradition, overlays), tradition.id);
      assert.equal(new Set(scene.markers.map(({ id }) => id)).size, scene.markers.length);
      const canonicalIds = new Set(scene.canonical.map(({ id }) => id));
      for (const marker of scene.markers) {
        finiteVector(marker.position, 2, `${tradition.id}/${marker.id}: SVG position`);
        finiteVector(marker.world, 3, `${tradition.id}/${marker.id}: 3D position`);
        assert.ok(marker.position[0] >= 0 && marker.position[0] <= WIDTH, `${marker.id}: horizontal bounds`);
        assert.ok(marker.position[1] >= 0 && marker.position[1] <= HEIGHT, `${marker.id}: vertical bounds`);
        assert.ok(canonicalIds.has(marker.canonicalParentId), `${marker.id}: missing canonical selection target`);
      }
      assert.ok(scene.dust.length <= 256, 'decoration stays bounded');
      for (const particle of scene.dust) {
        finiteVector(particle.position, 2, 'SVG particle');
        finiteVector(particle.world, 3, '3D particle');
      }
      for (const ring of scene.rings) {
        finiteVector(ring.position, 2, 'SVG ring');
        finiteVector(ring.world, 3, '3D ring');
        assert.ok([ring.rx, ring.ry, ring.radius, ring.opacity].every(Number.isFinite), ring.id);
        assert.ok(ring.rx > 0 && ring.ry > 0 && ring.radius > 0, ring.id);
      }
    }
  }
});

test('all source and schematic connections use non-straight finite cubic curves', () => {
  for (const tradition of traditions) {
    const scene = getScene(tradition);
    assert.equal(scene.edges.length, tradition.edges.length, `${tradition.id}: no dropped source connection`);
    for (const edge of scene.edges) {
      assert.equal(edge.points.length, 4);
      for (const point of edge.points) finiteVector(point, 2, edge.id);
      assert.deepEqual(edge.points[0], edge.from.position);
      assert.deepEqual(edge.points[3], edge.to.position);
      const [start, control, , end] = edge.points;
      const cross = (control[0] - start[0]) * (end[1] - start[1]) - (control[1] - start[1]) * (end[0] - start[0]);
      assert.ok(Math.abs(cross) > 0.001, `${tradition.id}/${edge.id}: connector became a straight spoke`);
      const path = curvePath(edge.from.position, edge.to.position, edge.bend);
      assert.match(path, /^M .* C /u);
      assert.doesNotMatch(path, /NaN|Infinity|\bL\b/u);
    }
  }
});

test('traveling sparks follow the same curve and reach its actual endpoint', () => {
  const from = [25, 60];
  const to = [420, 280];
  const original = structuredClone([from, to]);
  const curve = curvePoints(from, to);
  assert.deepEqual(pointOnCurve(curve, 0), from);
  assert.deepEqual(pointOnCurve(curve, 1), to);
  const midpoint = pointOnCurve(curve, 0.5);
  finiteVector(midpoint, 2, 'spark midpoint');
  assert.notDeepEqual(midpoint, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]);
  assert.deepEqual([from, to], original, 'building a curve must not move its input nodes');
});

test('paired aspects add twenty-four visual markers while keeping twelve sourced aeon identities', () => {
  const tradition = getTradition('john');
  const ordinary = getScene(tradition);
  const paired = getScene(tradition, { paired: true });
  const aeons = paired.markers.filter(({ kind }) => kind === 'aeon');
  assert.equal(ordinary.markers.filter(({ kind }) => kind === 'aeon').length, 12);
  assert.equal(aeons.length, 24);
  assert.equal(paired.markers.length, ordinary.markers.length + 12);
  assert.deepEqual(paired.canonical, ordinary.canonical, 'the interpretation must not mutate the source model');
  const parentIds = new Set(aeons.map(({ canonicalParentId }) => canonicalParentId));
  assert.equal(parentIds.size, 12);
  for (const parentId of parentIds) {
    const parent = tradition.nodes.find(({ id }) => id === parentId);
    const aspects = aeons.filter(({ canonicalParentId }) => canonicalParentId === parentId);
    assert.deepEqual(aspects.map(({ aspect }) => aspect).sort(), ['feminine', 'masculine']);
    for (const aspect of aspects) {
      assert.equal(aspect.node, parent);
      assert.deepEqual(aspect.node.sourceIds, parent.sourceIds);
    }
  }
  for (const other of traditions.filter(({ id }) => id !== 'john')) {
    assert.deepEqual(getScene(other, { paired: true }).markers, getScene(other).markers, other.id);
  }
});

test('the planetary overlay remains separate from the seven heavens and adds no ruler-to-planet edges', () => {
  const tradition = getTradition('john');
  const ordinary = getScene(tradition);
  const comparison = getScene(tradition, { planets: true });
  const planets = comparison.markers.filter(({ kind }) => kind === 'planet');
  assert.equal(planets.length, 7);
  assert.equal(comparison.markers.length, ordinary.markers.length + 7);
  assert.equal(comparison.markers.filter(({ kind }) => kind === 'heaven').length, 7);
  assert.equal(comparison.rings.filter(({ planetary }) => planetary).length, 7);
  assert.equal(comparison.rings.filter(({ heaven }) => heaven).length, 7);
  assert.deepEqual(comparison.edges, ordinary.edges, 'classical labels must not invent Gnostic identities or connections');
  for (const marker of planets) {
    assert.ok(planetaryNodes.includes(marker.node));
    assert.deepEqual(marker.node.sourceIds, ['cicero-planets']);
  }
  for (const other of traditions.filter(({ id }) => id !== 'john')) {
    assert.equal(getScene(other, { planets: true }).markers.some(({ kind }) => kind === 'planet'), false);
  }
});

test('planetary comparison markers leave room for source nodes and labels in the 2D map', () => {
  const tradition = getTradition('john');
  // Planet hit radii are 28 units and source hit radii reach 33; leave extra room for labels.
  const minimumSeparation = 120;
  for (const paired of [false, true]) {
    const scene = getScene(tradition, { planets: true, paired });
    const planets = scene.markers.filter(({ kind }) => kind === 'planet');
    const sourceMarkers = scene.markers.filter(({ kind }) => kind !== 'planet');
    for (const planet of planets) {
      for (const source of sourceMarkers) {
        const distance = Math.hypot(...planet.position.map((value, axis) => value - source.position[axis]));
        assert.ok(distance >= minimumSeparation,
          `${planet.id} overlaps ${source.id} with paired aspects ${paired}: ${distance.toFixed(2)} units`);
      }
    }
  }
});

test('all source layers have finite focus targets without changing selection identity', () => {
  for (const tradition of traditions) {
    const scene = getScene(tradition);
    for (const layer of tradition.layers) {
      const members = scene.canonical.filter(({ node }) => node.layer === layer.id);
      assert.ok(members.length > 0, `${tradition.id}/${layer.id}: empty camera target`);
      const focus = focusFor(scene, layer.id);
      finiteVector(focus.center, 2, `${layer.id}: 2D focus`);
      finiteVector(focus.world, 3, `${layer.id}: 3D focus`);
      assert.ok(Number.isFinite(focus.scale) && focus.scale > 0);
      for (let axis = 0; axis < 2; axis++) {
        const values = members.map(({ position }) => position[axis]);
        assert.ok(focus.center[axis] >= Math.min(...values) && focus.center[axis] <= Math.max(...values));
      }
    }
    assert.deepEqual(focusFor(scene, 'missing-layer'), focusFor(scene, 'all'));
  }
});
