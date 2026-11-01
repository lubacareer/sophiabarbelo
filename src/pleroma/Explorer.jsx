import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { getTradition, localize, planetaryNodes, sources, traditions } from './catalog.js';
import { t } from './messages.js';
import Atlas2D from './Atlas2D.jsx';
import cloudUrl from './assets/sophia-cloud.png';
import './explorer.css';

const Atlas3D = lazy(() => import('./Atlas3D.jsx'));

const kindLabels = {
  en: { root: 'Divine source', faculty: 'Faculty', autogenes: 'Autogenes', luminary: 'Luminary', aeon: 'Aeon', cloud: 'Cloud', ruler: 'Lower ruler', heaven: 'Heaven', wheel: 'Wheel', creature: 'Living creature', eyes: 'Eyes', expanse: 'Expanse', throne: 'Throne', sefirah: 'Sefirah', hypostasis: 'Principle', cosmos: 'Sensible cosmos', planet: 'Classical planet' },
  he: { root: 'מקור אלוהי', faculty: 'תכונה', autogenes: 'אוטוגנס', luminary: 'מאור', aeon: 'איון', cloud: 'ענן', ruler: 'שליט תחתון', heaven: 'רקיע', wheel: 'אופן', creature: 'חיה', eyes: 'עיניים', expanse: 'רקיע', throne: 'כיסא', sefirah: 'ספירה', hypostasis: 'עיקרון', cosmos: 'עולם החושים', planet: 'כוכב לכת בסדר הקלאסי' },
  ru: { root: 'Божественный источник', faculty: 'Свойство', autogenes: 'Автоген', luminary: 'Светило', aeon: 'Эон', cloud: 'Облако', ruler: 'Нижний правитель', heaven: 'Небо', wheel: 'Колесо', creature: 'Живое существо', eyes: 'Очи', expanse: 'Свод', throne: 'Престол', sefirah: 'Сефира', hypostasis: 'Начало', cosmos: 'Чувственный космос', planet: 'Классическая планета' },
};

export function useMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const change = () => setMatches(media.matches);
    change();
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [query]);
  return matches;
}

class GraphicsBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Icon({ name, ...props }) {
  const paths = {
    close: <><path d="m5 5 14 14M19 5 5 19" /></>,
    plus: <path d="M12 4v16M4 12h16" />,
    minus: <path d="M4 12h16" />,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
    external: <><path d="M14 3h7v7M21 3l-9 9M10 5H4v15h15v-6" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    down: <path d="m5 9 7 7 7-7" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

function SourceInspector({ node, tradition, language, onClose, tab, setTab, headingRef, paired }) {
  const [expanded, setExpanded] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => { setExpanded(false); setSourceIndex(0); }, [node.id, tradition.id]);
  const records = node.sourceIds.map((id) => sources[id]).filter(Boolean);
  const source = records[sourceIndex] || records[0];
  const label = localize(node.label, language);
  const group = tradition.nodes.find(({ id }) => id === node.group);
  const category = kindLabels[language]?.[node.kind] || kindLabels.en[node.kind] || '';
  return <aside className="pleroma-inspector" aria-label={t(language, 'sourcePanel')}>
    <div className="inspector-heading">
      <div>
        <h2 tabIndex={-1} ref={headingRef}>{label}</h2>
        <p>{node.order && node.kind === 'sefirah' ? node.order + ' · ' : ''}{category}{group ? ' · ' + localize(group.label, language) : ''}</p>
      </div>
      <button type="button" className="icon-button inspector-close" onClick={onClose} aria-label={t(language, 'closeInspector')}><Icon name="close" /></button>
    </div>
    <div className="inspector-tabs" role="tablist" aria-label={t(language, 'sourcePanel')}>
      {['source', 'interpretation'].map((id) => <button type="button" key={id} id={'inspector-tab-' + id} role="tab" aria-selected={tab === id} aria-controls="inspector-content" tabIndex={tab === id ? 0 : -1}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 'source' : event.key === 'End' ? 'interpretation' : id === 'source' ? 'interpretation' : 'source';
          setTab(next);
          document.getElementById('inspector-tab-' + next)?.focus();
        }}
        onClick={() => setTab(id)}>{t(language, id)}</button>)}
    </div>
    <div id="inspector-content" role="tabpanel" aria-labelledby={'inspector-tab-' + tab}>
      {paired && node.kind === 'aeon' && <p className="inspector-interpretive-note">{t(language, 'aspectsLabel', { name: label })}</p>}
      {tab === 'source' && source ? <>
        {records.length > 1 && <label className="source-edition-select">{t(language, 'reference')}
          <select value={sourceIndex} onChange={(event) => { setSourceIndex(Number(event.target.value)); setExpanded(false); }}>
            {records.map((record, index) => <option key={record.reference + index} value={index}>{record.reference}</option>)}
          </select>
        </label>}
        <p className="source-title" dir="auto">{source.title}{source.witness ? ' · ' + source.witness : ''}</p>
        <p className="source-reference" dir="auto">{source.reference}</p>
        <blockquote className="source-quotation" lang={source.language} dir={source.direction || 'auto'} id="source-exact-passage">{expanded ? source.context || source.excerpt : source.excerpt}</blockquote>
        {source.excerpt?.includes('[') && <p className="source-language-note">{t(language, 'restorations')}</p>}
        <div className="source-attribution">
          <p dir="auto">{source.translator}</p>
          <p><a href={safeUrl(source.rightsUrl)} target="_blank" rel="noopener noreferrer">{source.rights}</a></p>
        </div>
        <button type="button" className="passage-button" aria-expanded={expanded} aria-controls="source-exact-passage" onClick={() => setExpanded(!expanded)}>
          {t(language, expanded ? 'collapsePassage' : 'readFullPassage')}<Icon name={expanded ? 'down' : 'chevron'} />
        </button>
        <a className="open-source" href={safeUrl(source.url)} target="_blank" rel="noopener noreferrer">{t(language, 'openSource')}<Icon name="external" /></a>
        {source.language !== language && <p className="source-language-note">{t(language, 'sourceLanguageWarning')}</p>}
      </> : <>
        <p className="editorial-label">{t(language, 'editorial')}</p>
        <p className="inspector-summary">{localize(node.summary, language)}</p>
        <p className="inspector-summary">{localize(node.interpretation, language)}</p>
        <p className="source-language-note">{t(language, 'interpretationNote')}</p>
      </>}
    </div>
  </aside>;
}

export default function Explorer({ language, route, onRouteChange }) {
  const tradition = getTradition(route.tradition);
  const isMobile = useMedia('(max-width: 760px)');
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)');
  const [zoom, setZoom] = useState(1);
  const [focusLayer, setFocusLayer] = useState('all');
  const [cameraKey, setCameraKey] = useState(0);
  const [eventKey, setEventKey] = useState(0);
  const [tab, setTab] = useState('source');
  const [listOpen, setListOpen] = useState(false);
  const [overlayMenu, setOverlayMenu] = useState(false);
  const [webglFallback, setWebglFallback] = useState(false);
  const headingRef = useRef(null);
  const listButtonRef = useRef(null);
  const overlayButtonRef = useRef(null);
  const returnFocusRef = useRef(null);
  const listRef = useRef(null);
  const inspectorRef = useRef(null);
  const visibleNodes = [...tradition.nodes, ...(tradition.id === 'john' && route.overlays.planets ? planetaryNodes : [])];
  const duplicateLabels = new Set(visibleNodes.filter((node, index, all) => all.some((other, otherIndex) => otherIndex !== index && localize(other.label, language) === localize(node.label, language))).map((node) => localize(node.label, language)));
  const requestedNode = route.node === 'none' ? null : visibleNodes.find(({ id }) => id === route.node);
  const selected = route.node === 'none' ? null : requestedNode || visibleNodes.find(({ id }) => id === tradition.defaultNode) || visibleNodes[0];
  const overlaysEnabled = Object.values(route.overlays).some(Boolean);

  useEffect(() => {
    setZoom(1); setFocusLayer('all'); setCameraKey((value) => value + 1);
    setTab('source'); setListOpen(false); setOverlayMenu(false);
    setEventKey((value) => value + 1);
  }, [tradition.id]);
  useEffect(() => { setEventKey((value) => value + 1); }, [selected?.id, route.mode]);
  useEffect(() => {
    if (route.node && route.node !== 'none' && !requestedNode) onRouteChange({ node: tradition.defaultNode }, true);
  }, [requestedNode, route.node, tradition.defaultNode, onRouteChange]);
  useEffect(() => { if (listOpen) listRef.current?.querySelector('[data-entity]')?.focus(); }, [listOpen]);

  function closeInspector() {
    onRouteChange({ node: 'none' });
    requestAnimationFrame(() => {
      const target = returnFocusRef.current;
      if (target?.isConnected && typeof target.focus === 'function') target.focus();
      else listButtonRef.current?.focus();
    });
  }
  function selectNode(id) {
    if (!inspectorRef.current?.contains(document.activeElement)) returnFocusRef.current = document.activeElement;
    onRouteChange({ node: id }); setListOpen(false);
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  }
  useEffect(() => {
    function escape(event) {
      if (event.key !== 'Escape') return;
      if (overlayMenu) { setOverlayMenu(false); overlayButtonRef.current?.focus(); event.preventDefault(); }
      else if (listOpen) { setListOpen(false); listButtonRef.current?.focus(); event.preventDefault(); }
      else if (selected) { closeInspector(); event.preventDefault(); }
    }
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  });

  function changeTradition(id) {
    const next = getTradition(id);
    onRouteChange({ tradition: id, node: next.defaultNode, overlays: { paired: false, planets: false, torus: false } });
  }
  function changeOverlay(id, checked) {
    onRouteChange({ overlays: { ...route.overlays, [id]: checked } }, true);
    setEventKey((value) => value + 1);
  }
  const graphicsFailure = useCallback(() => {
    setWebglFallback(true);
    onRouteChange({ mode: '2d' }, true);
  }, [onRouteChange]);
  function fit() { setZoom(1); setFocusLayer('all'); setCameraKey((value) => value + 1); }
  const primaryOverlay = tradition.id === 'john' ? 'paired' : tradition.id === 'ezekiel' ? 'torus' : null;
  const primaryOverlayLabel = primaryOverlay === 'paired' ? 'pairedAspects' : 'toroidal';
  const rendererProps = { tradition, language, selectedId: selected?.id, onSelect: selectNode, overlays: route.overlays, zoom, focusLayer, cameraKey, reducedMotion, eventKey, cloudUrl, onFailure: graphicsFailure };

  return <section className="pleroma" aria-labelledby="pleroma-title">
    <div className="pleroma-title-row"><h1 id="pleroma-title">{t(language, 'title')}</h1><p>{t(language, 'subtitle')}</p></div>
    <div className="pleroma-toolbar">
      <nav className="tradition-tabs" aria-label={t(language, 'traditionNavigation')}>
        {traditions.map((item) => <button type="button" key={item.id} aria-pressed={tradition.id === item.id} onClick={() => changeTradition(item.id)}>{localize(item.title, language)}</button>)}
      </nav>
      <div className="pleroma-display-controls">
        <div className="dimension-switch" role="group" aria-label={t(language, 'mapLabel')}>
          {['2d', '3d'].map((mode) => <button key={mode} type="button" aria-pressed={route.mode === mode} onClick={() => { setWebglFallback(false); onRouteChange({ mode }); }}>{mode === '2d' ? '2D' : '3D'}</button>)}
        </div>
        <div className="overlay-control">
          <label className="overlay-toggle"><input type="checkbox" checked={isMobile && primaryOverlay ? route.overlays[primaryOverlay] : overlaysEnabled || overlayMenu}
            onChange={(event) => { if (primaryOverlay) changeOverlay(primaryOverlay, event.target.checked); if (!event.target.checked) onRouteChange({ overlays: { paired: false, planets: false, torus: false } }, true); setOverlayMenu(isMobile ? false : event.target.checked); if (!primaryOverlay && event.target.checked) setTab('interpretation'); }} />
            <span>{t(language, isMobile && primaryOverlay ? primaryOverlayLabel : 'interpretiveOverlays')}</span></label>
          <button className="overlay-menu-button icon-button" ref={overlayButtonRef} type="button" aria-label={t(language, overlayMenu ? 'hideOverlays' : 'showOverlays')} aria-expanded={overlayMenu} aria-controls="overlay-options" onClick={() => setOverlayMenu(!overlayMenu)}><Icon name="down" /></button>
          {overlayMenu && <fieldset className="overlay-options" id="overlay-options">
            <legend>{t(language, 'interpretiveOverlays')}</legend>
            {tradition.id === 'john' && <>
              <label><input type="checkbox" checked={route.overlays.paired} onChange={(event) => changeOverlay('paired', event.target.checked)} />{t(language, 'pairedAspects')}</label>
              <p>{t(language, 'pairedExplanation')}</p>
              <label><input type="checkbox" checked={route.overlays.planets} onChange={(event) => changeOverlay('planets', event.target.checked)} />{t(language, 'classicalPlanets')}</label>
              <p>{t(language, 'planetsExplanation')}</p>
            </>}
            {tradition.id === 'ezekiel' && <><label><input type="checkbox" checked={route.overlays.torus} onChange={(event) => changeOverlay('torus', event.target.checked)} />{t(language, 'toroidal')}</label><p>{t(language, 'toroidalExplanation')}</p></>}
            {['tree', 'plotinus'].includes(tradition.id) && <p>{t(language, 'interpretationNote')}</p>}
          </fieldset>}
        </div>
      </div>
    </div>
    {isMobile && route.overlays.paired && <p className="mobile-overlay-caption">{t(language, 'pairedExplanation')}</p>}
    {webglFallback && <p className="pleroma-status" role="status">{t(language, 'webglFallback')}</p>}
    <div className={'pleroma-workspace' + (selected ? ' has-inspector' : '')}>
      <div className="pleroma-canvas" aria-label={t(language, 'mapLabel')}>
        <div className="atlas-renderer" key={tradition.id} data-mode={route.mode}>
          {route.mode === '3d' ? <GraphicsBoundary key={tradition.id} onFailure={graphicsFailure}>
            <Suspense fallback={<p className="map-loading" role="status">{t(language, 'loading3d')}</p>}><Atlas3D {...rendererProps} /></Suspense>
          </GraphicsBoundary> : <Atlas2D {...rendererProps} />}
        </div>
        <div className="canvas-bottom-bar">
          <nav className="layer-navigation" aria-label={t(language, 'layerNavigation')}>
            {(tradition.layers || []).map((layer) => <button type="button" key={layer.id} aria-pressed={focusLayer === layer.id} onClick={() => { setFocusLayer(layer.id); setZoom(1); setCameraKey((value) => value + 1); }}>{localize(layer.label, language)}</button>)}
          </nav>
          <div className="camera-and-list">
            <div className="camera-controls" role="group" aria-label={t(language, 'mapLabel')}>
              <button type="button" aria-label={t(language, 'zoomIn')} onClick={() => setZoom((value) => Math.min(2.8, value + 0.25))} disabled={zoom >= 2.8}><Icon name="plus" /></button>
              <button type="button" aria-label={t(language, 'zoomOut')} onClick={() => setZoom((value) => Math.max(0.6, value - 0.25))} disabled={zoom <= 0.6}><Icon name="minus" /></button>
              <button type="button" onClick={fit}>{t(language, 'fit')}</button>
            </div>
            <button type="button" className="list-view-button" ref={listButtonRef} aria-expanded={listOpen} aria-controls="pleroma-entity-list" onClick={() => setListOpen(!listOpen)}><Icon name="list" /><span>{t(language, 'listView')}</span></button>
          </div>
        </div>
        <p className="spatial-note">{tradition.id === 'tree' ? t(language, 'schematicNote') : t(language, 'spatialNote')}</p>
        {listOpen && <section className="entity-list-panel" id="pleroma-entity-list" ref={listRef} aria-labelledby="entity-list-heading">
          <div><h2 id="entity-list-heading">{t(language, 'entityList')}</h2><button type="button" className="icon-button" aria-label={t(language, 'closeList')} onClick={() => { setListOpen(false); listButtonRef.current?.focus(); }}><Icon name="close" /></button></div>
          <ul>{visibleNodes.map((node) => <li key={node.id}><button type="button" data-entity={node.id} aria-pressed={selected?.id === node.id} onClick={() => selectNode(node.id)}>{localize(node.label, language)}{duplicateLabels.has(localize(node.label, language)) && <small className="entity-kind">{kindLabels[language][node.kind]}{node.group ? ' · ' + localize(tradition.nodes.find(({ id }) => id === node.group)?.label, language) : ''}</small>}</button></li>)}</ul>
        </section>}
      </div>
      {selected && <div className="inspector-holder" ref={inspectorRef}><SourceInspector node={selected} tradition={tradition} language={language} onClose={closeInspector} tab={tab} setTab={setTab} headingRef={headingRef} paired={route.overlays.paired} /></div>}
    </div>
  </section>;
}
