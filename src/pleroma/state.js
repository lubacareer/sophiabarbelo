const traditionIds = ['john', 'ezekiel', 'tree', 'plotinus'];
const overlayIds = ['paired', 'planets', 'torus'];

export function readExplorerRoute(search, defaultMode = '3d') {
  const params = new URLSearchParams(search);
  const tradition = traditionIds.includes(params.get('tradition')) ? params.get('tradition') : 'john';
  const requestedNode = params.get('node');
  const overlays = (params.get('overlays') || '').split(',');
  return {
    view: params.get('view') === 'pleroma' ? 'pleroma' : 'analyze',
    tradition,
    node: requestedNode && /^[a-z0-9-]{1,80}$/u.test(requestedNode) ? requestedNode : null,
    mode: ['2d', '3d'].includes(params.get('mode')) ? params.get('mode') : defaultMode,
    overlays: {
      paired: tradition === 'john' && overlays.includes('paired'),
      planets: tradition === 'john' && overlays.includes('planets'),
      torus: tradition === 'ezekiel' && overlays.includes('torus'),
    },
  };
}

export function explorerSearch(search, next) {
  const params = new URLSearchParams(search);
  for (const key of ['view', 'tradition', 'node', 'mode', 'overlays']) params.delete(key);
  if (next.view === 'pleroma') {
    const tradition = traditionIds.includes(next.tradition) ? next.tradition : 'john';
    params.set('view', 'pleroma');
    params.set('tradition', tradition);
    if (next.node && /^[a-z0-9-]{1,80}$/u.test(next.node)) params.set('node', next.node);
    params.set('mode', next.mode === '2d' ? '2d' : '3d');
    const allowed = tradition === 'john' ? ['paired', 'planets'] : tradition === 'ezekiel' ? ['torus'] : [];
    const enabled = overlayIds.filter((id) => allowed.includes(id) && next.overlays?.[id]);
    if (enabled.length) params.set('overlays', enabled.join(','));
  }
  const query = params.toString();
  return query ? '?' + query : '';
}
