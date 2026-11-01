import { planetaryNodes } from './catalog.js';

// Renderer-independent atlas coordinates. Geometry illustrates relationships;
// it is not evidence that a source specifies literal spatial distances.
export const WIDTH = 1100;
export const HEIGHT = 760;
export const planetNames = [
  { en: 'Moon', he: 'ירח', ru: 'Луна' },
  { en: 'Mercury', he: 'כוכב חמה', ru: 'Меркурий' },
  { en: 'Venus', he: 'נוגה', ru: 'Венера' },
  { en: 'Sun', he: 'שמש', ru: 'Солнце' },
  { en: 'Mars', he: 'מאדים', ru: 'Марс' },
  { en: 'Jupiter', he: 'צדק', ru: 'Юпитер' },
  { en: 'Saturn', he: 'שבתאי', ru: 'Сатурн' },
];

export function textFor(value, language = 'en') {
  return typeof value === 'string' ? value : value?.[language] || value?.en || '';
}

const johnGroups = {
  armozel: { position: [550, 175], world: [-2.8, 0, -1.85], angle: -Math.PI / 2 },
  oriael: { position: [750, 385], world: [2.8, 0, -1.85], angle: 0 },
  daveithai: { position: [350, 385], world: [-2.8, 0, 1.85], angle: Math.PI },
  eleleth: { position: [550, 595], world: [2.8, 0, 1.85], angle: Math.PI / 2 },
};
const treePositions = {
  keter: [550, 80], chokhmah: [750, 175], binah: [350, 175],
  chesed: [750, 310], gevurah: [350, 310], tiferet: [550, 385],
  netzach: [750, 490], hod: [350, 490], yesod: [550, 590], malkhut: [550, 690],
};

function positionOf(node, tradition, index) {
  const order = Number.isFinite(node.order) ? node.order : index;
  if (node.kind === 'planet') {
    const radius = 2.0 + order * 0.52;
    return { position: [990, 220 + order * 62], world: [Math.cos(0.48) * radius, 0.65, Math.sin(0.48) * radius] };
  }
  if (tradition.id === 'john') {
    if (johnGroups[node.id]) return johnGroups[node.id];
    if (node.kind === 'aeon') {
      const group = johnGroups[node.group] || johnGroups.eleleth;
      const angle = group.angle + (order - 1) * 0.75;
      const localAngle = [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6][order % 3];
      return {
        position: [group.position[0] + Math.cos(angle) * 104, group.position[1] + Math.sin(angle) * 104],
        world: [group.world[0] + Math.cos(localAngle) * 0.66, 0.08, group.world[2] + Math.sin(localAngle) * 0.66],
      };
    }
    if (node.id === 'invisible-spirit') return { position: [550, 337], world: [0, 0.46, 0] };
    if (node.id === 'barbelo') return { position: [550, 410], world: [0, 0.03, 0] };
    if (node.id === 'autogenes') return { position: [550, 485], world: [0, 0.14, 0.73] };
    if (node.kind === 'faculty') {
      const angle = (index % 4) * Math.PI / 2 + Math.PI / 4;
      return { position: [550 + Math.cos(angle) * 68, 407 + Math.sin(angle) * 51], world: [Math.cos(angle) * 0.85, 0.04, Math.sin(angle) * 0.85] };
    }
    if (node.kind === 'cloud') return { position: [800, 150], world: [2.45, 2.25, -3.2] };
    if (node.kind === 'ruler') return { position: [905, 205], world: [3.15, 1.75, -2.35] };
    if (node.kind === 'heaven') {
      const o = Math.max(1, order);
      return { position: [1005 - o * 10, 310 + o * 41], world: [0, 1.4 + o * 0.31, -5.4 + o * 0.08] };
    }
  }
  if (tradition.id === 'tree') {
    const position = treePositions[node.id] || [550, 385];
    return { position, world: [(position[0] - 550) / 83, (690 - position[1]) / 94, 0] };
  }
  if (tradition.id === 'plotinus') {
    const positions = [[550, 385], [550, 245], [550, 125], [550, 50]];
    const position = positions[Math.min(3, order)];
    return { position, world: [0, 0.15 + order * 0.12, -order * 1.45] };
  }
  if (tradition.id === 'ezekiel') {
    const wheels = [[350, 335], [750, 335], [350, 565], [750, 565]];
    const position = wheels[order % 4];
    if (node.kind === 'throne') return { position: [550, 75], world: [0, 4.6, -1] };
    if (node.kind === 'expanse') return { position: [550, 180], world: [0, 3.35, -1] };
    if (node.kind === 'eyes') return { position: [930, 380], world: [3.65, 1.1, 0.7] };
    if (node.kind === 'creature') return { position: [position[0], position[1] - 90], world: [(position[0] - 550) / 78, 1.7, (position[1] - 450) / 75] };
    return { position, world: [(position[0] - 550) / 78, 0.72, (position[1] - 450) / 75] };
  }
  const angle = index * Math.PI * 2 / Math.max(1, tradition.nodes.length);
  return { position: [550 + Math.cos(angle) * 210, 380 + Math.sin(angle) * 210], world: [Math.cos(angle) * 3, 0, Math.sin(angle) * 3] };
}

function labelPriority(node) {
  return !['aeon', 'faculty', 'autogenes', 'heaven', 'creature', 'eyes', 'ruler'].includes(node.kind);
}

// Bends are deterministic, so 2D/3D mode switches never change source identity.
export function curvePoints(from, to, bend = 0.18) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  return [from, [from[0] + dx * 0.32 - dy * bend, from[1] + dy * 0.32 + dx * bend],
    [from[0] + dx * 0.68 - dy * bend, from[1] + dy * 0.68 + dx * bend], to];
}

export function curvePath(from, to, bend = 0.18) {
  const [a, b, c, d] = curvePoints(from, to, bend);
  return `M ${a.join(' ')} C ${b.join(' ')}, ${c.join(' ')}, ${d.join(' ')}`;
}

export function pointOnCurve(points, t) {
  const q = 1 - t;
  return [0, 1].map((axis) => q ** 3 * points[0][axis] + 3 * q ** 2 * t * points[1][axis] + 3 * q * t ** 2 * points[2][axis] + t ** 3 * points[3][axis]);
}

export function getScene(tradition, overlays = {}) {
  if (!tradition || !Array.isArray(tradition.nodes)) return { markers: [], labels: [], edges: [], rings: [], dust: [], cloud: null };
  const nodes = [...tradition.nodes, ...(tradition.id === 'john' && overlays.planets ? planetaryNodes : [])];
  const canonical = nodes.map((node, index) => ({ id: node.id, canonicalParentId: node.id, node, kind: node.kind, ...positionOf(node, tradition, index), major: labelPriority(node) }));
  const byId = new Map(canonical.map((marker) => [marker.id, marker]));
  const markers = canonical.flatMap((marker) => overlays.paired && tradition.id === 'john' && marker.kind === 'aeon'
    ? ['masculine', 'feminine'].map((aspect, i) => ({ ...marker, id: `${marker.id}-${aspect}`, aspect, major: false,
      position: [marker.position[0] + (i ? 11 : -11), marker.position[1]],
      world: [marker.world[0] + (i ? 0.11 : -0.11), marker.world[1], marker.world[2]] }))
    : [marker]);
  const edges = (tradition.edges || []).flatMap((edge, index) => {
    const from = byId.get(edge.from), to = byId.get(edge.to);
    if (!from || !to) return [];
    const bend = (index % 2 ? -1 : 1) * (tradition.id === 'tree' ? 0.17 : 0.22);
    return [{ ...edge, id: `${edge.from}-${edge.to}`, from, to, bend, points: curvePoints(from.position, to.position, bend) }];
  });
  const rings = [];
  if (tradition.id === 'john') {
    rings.push({ id: 'pleroma-boundary', position: [550, 385], rx: 347, ry: 301, world: [0, 0, 0], radius: 5.05, opacity: 0.32 });
    for (const [id, group] of Object.entries(johnGroups)) {
      rings.push({ id: `${id}-orbit`, position: group.position, rx: 125, ry: 117, world: group.world, radius: 1.09, opacity: 0.5 });
      rings.push({ id: `${id}-orbit-inner`, position: group.position, rx: 113, ry: 105, world: group.world, radius: 0.97, opacity: 0.22 });
    }
    rings.push({ id: 'barbelo-orbit', position: [550, 410], rx: 105, ry: 78, world: [0, 0, 0], radius: 1.45, opacity: 0.6 });
    for (let i = 0; i < 7; i++) rings.push({ id: `heaven-orbit-${i}`, position: [550, 385], rx: 380 + i * 18, ry: 328 + i * 10, world: [0, 1.5 + i * 0.31, -1.9], radius: 6.1 - i * 0.04, opacity: 0.13, heaven: true });
  }
  if (tradition.id === 'plotinus') for (let i = 1; i <= 3; i++) rings.push({ id: `emanation-ring-${i}`, position: [550, 385], rx: i * 140, ry: i * 108, world: [0, 0.14 + i * 0.12, 0], radius: i * 1.45, opacity: 0.8 - i * 0.13 });
  if (tradition.id === 'john' && overlays.planets) for (let i = 0; i < 7; i++) rings.push({ id: `planet-ring-${i}`, position: [550, 385], rx: 166 + i * 41, ry: 144 + i * 32, world: [0, 0.65, 0], radius: 2.0 + i * 0.52, opacity: 0.26, planetary: true });
  if (tradition.id === 'ezekiel') for (const marker of canonical.filter((m) => m.kind === 'wheel')) rings.push({ id: `${marker.id}-rim`, position: marker.position, rx: 98, ry: 62, world: marker.world, radius: 0.9, opacity: 0.75, wheel: true });
  const labels = canonical.filter((m) => m.major);
  const dust = Array.from({ length: 156 }, (_, i) => {
    const angle = i * 2.39996323;
    const radius = 30 + Math.sqrt((i * 67) % 156) * 31;
    return { id: i, position: [550 + Math.cos(angle) * radius * 1.1, 390 + Math.sin(angle) * radius * 0.78],
      world: [Math.cos(angle) * radius / 74, ((i * 29) % 70) / 35 - 0.3, Math.sin(angle) * radius / 85], size: 0.6 + (i % 5) * 0.25 };
  });
  return { markers, canonical, labels, edges, rings, dust, cloud: canonical.find((m) => m.kind === 'cloud') || null };
}

export function focusFor(scene, layer = 'all') {
  if (layer === 'all') return { center: [550, 385], world: [0, 1.0, -0.8], scale: 1 };
  const points = scene.canonical?.filter((m) => m.node.layer === layer) || [];
  if (!points.length) return { center: [550, 385], world: [0, 1, -0.8], scale: 1 };
  const average = (key, dimensions) => Array.from({ length: dimensions }, (_, i) => points.reduce((sum, m) => sum + m[key][i], 0) / points.length);
  return { center: average('position', 2), world: average('world', 3), scale: ['center', 'cloud', 'vision'].includes(layer) ? 1.65 : 1.14 };
}
