import { useId, useMemo } from 'react';
import { getScene, focusFor, curvePath, textFor, WIDTH, HEIGHT } from './geometry.js';
import './atlas.css';

const title = { en: 'Interactive cosmology map', he: 'מפת קוסמולוגיה אינטראקטיבית', ru: 'Интерактивная карта космологии' };

export default function Atlas2D({ tradition, language = 'en', selectedId, onSelect, overlays = {}, zoom = 1, focusLayer = 'all', reducedMotion = false, eventKey = 0, cameraKey = 0, cloudUrl }) {
  const uid = useId().replace(/:/g, '');
  const scene = useMemo(() => getScene(tradition, overlays), [tradition, overlays.paired, overlays.planets, overlays.torus]);
  const focus = focusFor(scene, focusLayer);
  const scale = Math.max(0.55, Math.min(3.0, zoom)) * focus.scale;
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
  const mobileFrames = { tree: '195 0 710 760', ezekiel: '130 0 910 760', plotinus: '90 0 920 760' };
  const viewBox = narrow && tradition.id === 'john' && focusLayer === 'all' && !overlays.planets ? '175 20 750 730'
    : narrow && mobileFrames[tradition.id] ? mobileFrames[tradition.id] : `0 0 ${WIDTH} ${HEIGHT}`;
  const transform = `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${scale}) translate(${-focus.center[0]} ${-focus.center[1]})`;
  const select = (event, id) => { event.stopPropagation(); onSelect(id); };
  const selected = scene.canonical.find((marker) => marker.id === selectedId);
  // These sparse curved wisps are illumination, not additional graph edges.
  // Their fixed coordinates leave the resting atlas still, including reduced motion.
  const lightWisps = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const angle = i * Math.PI / 6 + .18;
    const direction = i % 2 ? 1 : -1;
    const radius = 185 + (i % 3) * 31;
    const from = [550 + Math.cos(angle) * 40, 400 + Math.sin(angle) * 35];
    const to = [550 + Math.cos(angle + direction * .85) * radius, 400 + Math.sin(angle + direction * .85) * radius * .86];
    return { id: i, path: curvePath(from, to, direction * .7) };
  }), []);
  return <svg className={`atlas-svg${reducedMotion ? ' atlas-still' : ''}`} viewBox={viewBox} role="group" aria-label={textFor(title, language)} data-renderer="svg" data-tradition={tradition.id} data-camera-key={cameraKey}>
    <defs>
      <radialGradient id={`${uid}-halo`}><stop offset="0" stopColor="#fff4c9" stopOpacity=".95" /><stop offset=".12" stopColor="#ffdc87" stopOpacity=".66" /><stop offset=".42" stopColor="#e1ac42" stopOpacity=".18" /><stop offset="1" stopColor="#d4a64f" stopOpacity="0" /></radialGradient>
      <radialGradient id={`${uid}-node`} cx="37%" cy="30%"><stop offset="0" stopColor="#fffce5" /><stop offset=".55" stopColor="#ffe7a2" /><stop offset="1" stopColor="#c59639" /></radialGradient>
      <radialGradient id={`${uid}-sage`}><stop offset="0" stopColor="#effdf0" /><stop offset="1" stopColor="#7ea499" /></radialGradient>
      <filter id={`${uid}-glow`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.6" /></filter>
      <filter id={`${uid}-bloom`} x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="5" /></filter>
      <filter id={`${uid}-mist`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8" /></filter>
    </defs>
    <g transform={transform} className="atlas-svg-world" key={tradition.id}>
      <circle cx="550" cy="390" r="345" fill={`url(#${uid}-halo)`} opacity=".23" aria-hidden="true" />
      <g aria-hidden="true" className="atlas-dust">{scene.dust.map((dust) => <g key={dust.id} transform={`translate(${dust.position.join(' ')})`}>
        {dust.id % 9 === 0 && <><circle r="16" fill={`url(#${uid}-halo)`} opacity=".6" /><path d="M -6 0 Q 0 -1 6 0 M 0 -6 Q 1 0 0 6" fill="none" stroke="#ffebbd" strokeWidth=".65" opacity=".7" /></>}
        <circle r={dust.size * 1.12} fill={dust.id % 9 === 0 ? '#fff4ce' : '#e8c27a'} opacity={.34 + (dust.id % 6) * .085} />
      </g>)}</g>
      {tradition.id === 'john' && <g aria-hidden="true">{lightWisps.map((wisp) => <g key={wisp.id}>
        <path d={wisp.path} fill="none" stroke="#dca641" strokeWidth="5" opacity=".055" filter={`url(#${uid}-glow)`} />
        <path d={wisp.path} fill="none" stroke="#efcc7a" strokeWidth=".65" opacity=".18" />
      </g>)}</g>}
      <g aria-hidden="true">{scene.rings.map((ring) => <g key={ring.id} opacity={ring.heaven && focusLayer !== 'heavens' ? .24 : 1}>
        {!ring.heaven && <ellipse cx={ring.position[0]} cy={ring.position[1]} rx={ring.rx} ry={ring.ry} fill="none" stroke="#e6bd69" opacity={ring.opacity * .25} strokeWidth="4" filter={`url(#${uid}-glow)`} />}
        <ellipse cx={ring.position[0]} cy={ring.position[1]} rx={ring.rx} ry={ring.ry} fill="none" stroke={ring.planetary ? '#a8d8c6' : ring.heaven ? '#8daea8' : '#d5bd7d'} opacity={ring.opacity} strokeWidth={ring.wheel ? 2.1 : 1.05} strokeDasharray={ring.planetary ? '4 7' : ring.id === 'pleroma-boundary' ? '6 7' : undefined} />
        {ring.wheel && <ellipse cx={ring.position[0]} cy={ring.position[1]} rx={overlays.torus ? 51 : 35} ry={100} fill="none" stroke="#d5bd7d" opacity=".64" strokeWidth={overlays.torus ? 9 : 1.5} transform={`rotate(21 ${ring.position.join(' ')})`} />}
      </g>)}</g>
      {scene.cloud && cloudUrl && <image href={cloudUrl} x={scene.cloud.position[0] - 150} y={scene.cloud.position[1] - 107} width="300" height="145" opacity={focusLayer === 'cloud' ? .95 : .55} aria-hidden="true" />}
      {scene.cloud && !cloudUrl && <ellipse cx={scene.cloud.position[0]} cy={scene.cloud.position[1] - 7} rx="128" ry="39" fill="#bed6ca" opacity=".14" filter={`url(#${uid}-mist)`} aria-hidden="true" />}
      <g aria-hidden="true">{scene.edges.map((edge) => <g key={edge.id} opacity={edge.to.kind === 'heaven' && focusLayer !== 'heavens' ? .1 : .86}>
        <path d={curvePath(edge.from.position, edge.to.position, edge.bend)} fill="none" stroke="#f4bf53" strokeWidth="7" opacity=".24" filter={`url(#${uid}-glow)`} />
        <path d={curvePath(edge.from.position, edge.to.position, edge.bend)} fill="none" stroke={edge.kind === 'interpretive' ? '#b5d7c8' : '#f6d58b'} strokeWidth="1.75" opacity=".9" strokeDasharray={edge.kind === 'interpretive' ? '5 7' : undefined} />
        {edge.kind !== 'interpretive' && <path d={curvePath(edge.from.position, edge.to.position, edge.bend)} fill="none" stroke="#fff6d4" strokeWidth=".55" opacity=".7" />}
      </g>)}</g>
      {overlays.paired && tradition.id === 'john' && <g aria-hidden="true">{scene.canonical.filter((m) => m.kind === 'aeon').map((marker) => <path key={marker.id} d={curvePath([marker.position[0] - 11, marker.position[1]], [marker.position[0] + 11, marker.position[1]], -.35)} fill="none" stroke="#a5c9bb" strokeWidth="1.3" strokeDasharray="3 3" />)}</g>}
      <g className="atlas-svg-nodes">{scene.markers.map((marker) => {
        const active = marker.canonicalParentId === selectedId;
        const label = textFor(marker.node.label, language);
        const core = ['barbelo', 'invisible-spirit', 'one'].includes(marker.canonicalParentId);
        const size = marker.kind === 'sefirah' ? 20 : marker.major ? core ? 23 : 18 : marker.aspect ? 8 : 9;
        const visibleLabel = !marker.aspect && (marker.major || active);
        const heavenDim = marker.kind === 'heaven' && focusLayer !== 'heavens' && !active;
        const labelAbove = ['invisible-spirit', 'armozel', 'throne', 'expanse'].includes(marker.canonicalParentId);
        const labelLines = marker.kind === 'sefirah' ? label.split(' · ') : [label];
        const labelX = marker.kind === 'planet' ? size + 14 : 0;
        const labelY = marker.kind === 'planet' ? 8 : labelAbove ? -size - 18 : size + 29;
        const labelAnchor = marker.kind === 'planet'
          ? language === 'he' ? 'end' : 'start'
          : marker.position[0] > 850 ? 'end' : marker.position[0] < 250 ? 'start' : 'middle';
        return <g key={marker.id} role="button" tabIndex={0} aria-label={marker.aspect ? `${label} — ${marker.aspect === 'masculine' ? textFor({ en: 'masculine aspect', he: 'היבט זכרי', ru: 'мужской аспект' }, language) : textFor({ en: 'feminine aspect', he: 'היבט נקבי', ru: 'женский аспект' }, language)}` : label}
          aria-pressed={active} data-node-id={marker.canonicalParentId} className="atlas-svg-node" transform={`translate(${marker.position.join(' ')})`} opacity={heavenDim ? .18 : 1}
          onClick={(event) => select(event, marker.canonicalParentId)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(event, marker.canonicalParentId); } }}>
          <title>{label}</title>
          <circle r={Math.max(23, size + 10)} fill="transparent" />
          <circle r={size * (active || core ? 5.7 : marker.major ? 4 : 3.2)} fill={`url(#${uid}-halo)`} opacity={active || core ? .9 : .56} aria-hidden="true" pointerEvents="none" />
          {(active || marker.major) && <circle r={size + 3} fill="none" stroke="#f9cd70" strokeWidth="3.5" opacity=".55" filter={`url(#${uid}-bloom)`} aria-hidden="true" pointerEvents="none" />}
          {active && <circle r={size + 6} fill="none" stroke="#fff0be" strokeWidth="1.5" opacity=".95" aria-hidden="true" pointerEvents="none" />}
          <circle r={size} fill={marker.aspect === 'feminine' || marker.kind === 'planet' || marker.canonicalParentId === 'invisible-spirit' ? `url(#${uid}-sage)` : `url(#${uid}-node)`} stroke={marker.aspect === 'feminine' ? '#e1f7e7' : '#ffe6a0'} strokeWidth="1.7" />
          {marker.kind === 'sefirah' && <text className="atlas-svg-number" y="6" textAnchor="middle" aria-hidden="true">{marker.node.order}</text>}
          {visibleLabel && <text className={`atlas-svg-label${core ? ' atlas-svg-label-core' : ''}`} y={labelY} textAnchor={labelAnchor} direction={language === 'he' ? 'rtl' : 'ltr'}>{labelLines.map((line, index) => <tspan key={index} x={labelX} dy={index ? '1.15em' : '0'} fontSize={index ? '.9em' : undefined}>{line}</tspan>)}</text>}
        </g>;
      })}</g>
      {!reducedMotion && selected && <g className="atlas-selection-burst" key={`${eventKey}-${selectedId}`} transform={`translate(${selected.position.join(' ')})`} aria-hidden="true">
        <circle r="75" fill={`url(#${uid}-halo)`} className="atlas-burst-disc" />
        {Array.from({ length: 9 }, (_, i) => <path key={i} d={curvePath([0, 0], [Math.cos(i * 2.4) * 103, Math.sin(i * 2.4) * 103], .3)} fill="none" stroke="#ffdfa0" strokeWidth="1.3" className="atlas-burst-ray" style={{ '--ray-delay': `${i * 20}ms` }} />)}
      </g>}
      {!reducedMotion && <g key={`sparks-${eventKey}`} aria-hidden="true" pointerEvents="none">{scene.edges.filter((edge) => edge.from.id === selectedId || edge.to.id === selectedId).slice(0, 7).map((edge) => <circle key={edge.id} r="3.6" fill="#fff5cd" className="atlas-moving-spark"><animateMotion dur="1.2s" repeatCount="1" path={curvePath(edge.from.position, edge.to.position, edge.bend)} fill="freeze" /></circle>)}</g>}
    </g>
  </svg>;
}
