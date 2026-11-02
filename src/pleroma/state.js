const traditionIds = ['john', 'ezekiel', 'tree', 'plotinus'];
const overlayIds = ['paired', 'planets', 'torus', 'tarot', 'astrology'];
const validPath = (value, tradition, overlays) => tradition === 'tree' && (
  ((overlays.tarot || overlays.astrology) && /^hermetic-path-(?:1[1-9]|2[0-9]|3[0-2])$/u.test(value || ''))
  || (overlays.astrology && /^hermetic-sphere-(?:[1-9]|10)$/u.test(value || ''))
) ? value : null;

export function readExplorerRoute(search, defaultMode = '3d') {
  const params = new URLSearchParams(search);
  const tradition = traditionIds.includes(params.get('tradition')) ? params.get('tradition') : 'john';
  const requestedNode = params.get('node');
  const overlays = (params.get('overlays') || '').split(',');
  const enabled = {
    paired: tradition === 'john' && overlays.includes('paired'),
    planets: tradition === 'john' && overlays.includes('planets'),
    torus: tradition === 'ezekiel' && overlays.includes('torus'),
    tarot: tradition === 'tree' && overlays.includes('tarot'),
    astrology: tradition === 'tree' && overlays.includes('astrology'),
  };
  return {
    view: params.get('view') === 'pleroma' ? 'pleroma' : 'analyze',
    tradition,
    node: requestedNode && /^[a-z0-9-]{1,80}$/u.test(requestedNode) ? requestedNode : null,
    path: validPath(params.get('path'), tradition, enabled),
    mode: ['2d', '3d'].includes(params.get('mode')) ? params.get('mode') : defaultMode,
    overlays: enabled,
  };
}

export function explorerSearch(search, next) {
  const params = new URLSearchParams(search);
  for (const key of ['view', 'tradition', 'node', 'path', 'mode', 'overlays']) params.delete(key);
  if (next.view === 'pleroma') {
    const tradition = traditionIds.includes(next.tradition) ? next.tradition : 'john';
    params.set('view', 'pleroma');
    params.set('tradition', tradition);
    if (next.node && /^[a-z0-9-]{1,80}$/u.test(next.node)) params.set('node', next.node);
    params.set('mode', next.mode === '2d' ? '2d' : '3d');
    const allowed = tradition === 'john' ? ['paired', 'planets'] : tradition === 'ezekiel' ? ['torus'] : tradition === 'tree' ? ['tarot', 'astrology'] : [];
    const enabled = overlayIds.filter((id) => allowed.includes(id) && next.overlays?.[id]);
    if (enabled.length) params.set('overlays', enabled.join(','));
    const path = validPath(next.path, tradition, next.overlays || {});
    if (path) params.set('path', path);
  }
  const query = params.toString();
  return query ? '?' + query : '';
}
