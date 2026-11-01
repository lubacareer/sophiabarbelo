import { useEffect, useMemo, useState } from 'react';
import mirrorArtwork from './assets/sophia-mirror.png';
import { languages, languageNames, localeStorageKey, savedLanguage, translate } from './i18n.js';
import { presets } from './presets.js';
import { buildAnnotations, withFindingLinks } from './annotations.js';

const statuses = ['supported', 'contradicted', 'mixed', 'unverified'];
const categoryIds = ['scapegoating', 'selective_piety', 'shame_fear', 'demagogy', 'victim_blaming', 'intimidation', 'faulty_reasoning', 'other'];

function TextIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" /></svg>;
}

function LinkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 4.3l-1.7 1.8M14 11a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 19.7l1.7-1.8" /></svg>;
}

function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function responseError(message) {
  return Object.assign(new Error(message), { publicMessage: true });
}

function SourceLinks({ sources, language }) {
  const links = (sources ?? []).filter((source) => safeSourceUrl(source.url));
  if (!links.length) return null;
  return <div className="sources">
    <span>{translate(language, 'sources')}:</span>
    <ul>{links.map((source, index) => <li key={`${source.url}-${index}`}>
      <a href={safeSourceUrl(source.url)} target="_blank" rel="noopener noreferrer" dir="auto"><bdi>{source.title || source.url}</bdi></a>
    </li>)}</ul>
  </div>;
}

function InlineCitations({ sources, language }) {
  const links = (sources ?? []).filter((source) => safeSourceUrl(source.url));
  if (!links.length) return null;
  return <span className="inline-citations"> {links.map((source, index) => <span key={`${source.url}-${index}`}>
    {'['}<a href={safeSourceUrl(source.url)} target="_blank" rel="noopener noreferrer" aria-label={`${translate(language, 'sources')}: ${source.title || source.url}`}>{index + 1}</a>{']'}
  </span>)}</span>;
}

function ClaimCard({ claim, index, language, analysisLanguage }) {
  const status = statuses.includes(claim.status) ? claim.status : 'unverified';
  return <article className="finding" id={`claim-${index}`} tabIndex={-1}>
    <div className="finding-heading">
      <h3 dir="auto" lang={analysisLanguage}>{claim.claim}</h3>
      <span className={`status status-${status}`}>{translate(language, status)}</span>
    </div>
    {claim.excerpt && <blockquote className="claim-excerpt" dir="auto">“{claim.excerpt}”</blockquote>}
    <p dir="auto" lang={analysisLanguage}>{claim.explanation}<InlineCitations sources={claim.sources} language={language} /></p>
    <SourceLinks sources={claim.sources} language={language} />
  </article>;
}

function RhetoricCard({ observation, index, language, analysisLanguage }) {
  const category = categoryIds.includes(observation.categoryId) ? observation.categoryId : 'other';
  const flaw = observation.isReasoningFlaw === true && observation.explanation?.trim();
  return <article className="finding rhetoric-finding" id={`rhetoric-${index}`} tabIndex={-1}>
    <div className="finding-heading">
      <h3>{translate(language, category)}</h3>
      <span className={`status ${flaw ? 'status-contradicted' : ''}`}>{translate(language, flaw ? 'reasoningFailure' : 'rhetoricalObservation')}</span>
    </div>
    {category === 'other' && observation.category && <p dir="auto" lang={analysisLanguage}>{observation.category}</p>}
    {observation.excerpt && <blockquote dir="auto">“{observation.excerpt}”</blockquote>}
    <p dir="auto" lang={analysisLanguage}>{observation.explanation}</p>
  </article>;
}

function Results({ result, isLoading, language }) {
  const claims = result?.claims ?? [];
  const rhetoric = result?.rhetoric ?? [];
  const t = (key, values) => translate(language, key, values);
  return <section className="analysis" aria-labelledby="analysis-heading" aria-busy={isLoading}>
    <h2 id="analysis-heading">{t('analysis')}</h2>
    <p className="section-intro">{t('analysisIntro')}</p>
    {result && <p className="analysis-language">{t('resultLanguage', { language: languageNames[result.analysisLanguage] })}
      {result.analysisLanguage !== language && <> · {t('resultLanguageHint')}</>}
    </p>}
    <div className="results-grid">
      <section className="result-panel claims-panel" aria-labelledby="claims-heading">
        <h2 id="claims-heading">{t('claims')}</h2>
        <p className="panel-intro">{t('claimsIntro')}</p>
        {claims.length ? claims.map((claim, index) => <ClaimCard key={index} claim={claim} index={index} language={language} analysisLanguage={result.analysisLanguage} />) :
          <p className="empty-state">{t(result ? 'noClaims' : 'claimsEmpty')}</p>}
      </section>
      <section className="result-panel rhetoric-panel" aria-labelledby="rhetoric-heading">
        <h2 id="rhetoric-heading">{t('rhetoric')}</h2>
        <p className="panel-intro">{t('rhetoricIntro')}</p>
        {rhetoric.length ? rhetoric.map((observation, index) => <RhetoricCard key={index} observation={observation} index={index} language={language} analysisLanguage={result.analysisLanguage} />) :
          <p className="empty-state">{t(result ? 'noRhetoric' : 'rhetoricEmpty')}</p>}
      </section>
    </div>
    {result?.limitations?.length > 0 && <div className="limitations">
      <h3>{t('limitations')}</h3>
      <ul>{result.limitations.map((item, index) => <li key={index} dir="auto" lang={result.analysisLanguage}>{item}</li>)}</ul>
    </div>}
    <p className="interpretation-note">{t('interpretation')}</p>
  </section>;
}

function HighlightedText({ result, language }) {
  const segments = useMemo(() => withFindingLinks(buildAnnotations(result.sourceText, result)), [result]);
  const t = (key, values) => translate(language, key, values);
  function copySource(event) {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !event.clipboardData) return;
    const range = selection.getRangeAt(0);
    if (!event.currentTarget.contains(range.commonAncestorContainer)) return;
    const fragment = range.cloneContents();
    fragment.querySelectorAll('.annotation-links').forEach((links) => links.remove());
    event.clipboardData.setData('text/plain', fragment.textContent);
    event.preventDefault();
  }
  return <div className="highlight-panel">
    <p className="highlight-hint" id="highlight-hint">{t('highlightHint')}</p>
    <ul className="highlight-legend" aria-label={t('highlights')}>
      <li><span className="legend-swatch annotation-supported" aria-hidden="true" />{t('supportedLegend')}</li>
      <li><span className="legend-swatch annotation-problem" aria-hidden="true" />{t('problemLegend')}</li>
      <li><span className="legend-swatch annotation-neutral" aria-hidden="true" />{t('neutralLegend')}</li>
    </ul>
    <div className="annotated-source" role="region" aria-label={t('annotatedText')} aria-describedby="highlight-hint" dir="auto" tabIndex={0} onCopy={copySource}>
      {segments.map((segment) => segment.tone ? <span className="annotation-group" key={segment.start}>
        <mark className={`annotation annotation-${segment.tone}`}>{segment.text}</mark>
        {segment.links.length > 0 && <sup className="annotation-links">{segment.links.map((finding) => <a key={finding.id} href={`#${finding.id}`}
          aria-label={t('findingLink', { label: t(finding.labelKey), number: finding.index + 1 })}
          title={t('findingLink', { label: t(finding.labelKey), number: finding.index + 1 })}
          onClick={() => document.getElementById(finding.id)?.focus({ preventScroll: true })}>
          {t(finding.kind === 'claim' ? 'claimShort' : 'rhetoricShort')}{finding.index + 1}
        </a>)}</sup>}
      </span> : <span key={segment.start}>{segment.text}</span>)}
    </div>
  </div>;
}

function DemoPresets({ language, disabled, onSelect }) {
  const t = (key) => translate(language, key);
  return <section className="presets" aria-labelledby="presets-heading">
    <h2 id="presets-heading">{t('demos')}</h2>
    <p className="preset-hint">{t('demosHint')}</p>
    <div className="preset-groups">{['ancient', 'media'].map((group) => <fieldset key={group}>
      <legend>{t(group)}</legend>
      <div className="preset-buttons">{presets.filter((preset) => preset.group === group).map((preset) => <button
        type="button" className="preset-button" key={preset.id} disabled={disabled} onClick={() => onSelect(preset)}>
        <strong>{preset.locales[language].title}</strong><span>{preset.locales[language].description}</span>
      </button>)}</div>
    </fieldset>)}</div>
  </section>;
}

export default function App() {
  const [language, setLanguage] = useState(savedLanguage);
  const [type, setType] = useState('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState('');
  const [supportsReasoning, setSupportsReasoning] = useState(false);
  const [result, setResult] = useState(null);
  const [view, setView] = useState('edit');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const t = (key, values) => translate(language, key, values);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
    document.querySelector('meta[name="description"]')?.setAttribute('content', translate(language, 'analysisIntro'));
    try { window.localStorage.setItem(localeStorageKey, language); } catch { /* Locale persistence is optional. */ }
  }, [language]);

  useEffect(() => {
    const controller = new AbortController();
    const endpoint = window.location.pathname.startsWith('/admin/') ? '/admin/api/config' : '/api/config';
    fetch(endpoint, { signal: controller.signal, headers: { 'Accept-Language': language } })
      .then((response) => response.ok ? response.json() : null)
      .then((config) => setSupportsReasoning(config?.reasoningControls === true))
      .catch(() => {});
    return () => controller.abort();
  }, [language]);

  function clearResult() { setResult(null); setView('edit'); setError(null); }

  function loadPreset(preset) {
    clearResult();
    setType('text');
    setText(preset.locales[language].text);
    setSelectedPreset({ ...preset, selectedLanguage: language });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const content = (type === 'text' ? text : url).trim();
    if (!content) { setError({ key: type === 'text' ? 'enterText' : 'enterUrl' }); return; }
    clearResult();
    setIsLoading(true);
    const requestLanguage = language;
    try {
      const endpoint = window.location.pathname.startsWith('/admin/') ? '/admin/api/analyze' : '/api/analyze';
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': requestLanguage },
        body: JSON.stringify({ type, content, language: requestLanguage, ...(reasoningEffort ? { reasoningEffort } : {}) }),
      });
      let data;
      try { data = await response.json(); } catch { throw responseError(translate(requestLanguage, 'unexpected')); }
      if (!response.ok) throw responseError(typeof data?.error === 'string' ? data.error : translate(requestLanguage, 'failed'));
      if (!Array.isArray(data?.claims) || !Array.isArray(data?.rhetoric) || typeof data?.sourceText !== 'string') throw responseError(translate(requestLanguage, 'incomplete'));
      setResult({ ...data, analysisLanguage: requestLanguage });
      setView('highlights');
    } catch (err) {
      setError({ message: err?.publicMessage ? err.message : translate(requestLanguage, 'failed'), language: requestLanguage });
    } finally { setIsLoading(false); }
  }

  return <main className="shell">
    <header className="masthead">
      <div className="masthead-copy">
        <label className="language-selector">{t('language')}
          <select value={language} onChange={(event) => { setLanguage(event.target.value); setError(null); }} disabled={isLoading}>
            {languages.map((code) => <option key={code} value={code} lang={code}>{languageNames[code]}</option>)}
          </select>
        </label>
        <h1>Sophia’s Mirror</h1><p>{t('tagline')}</p><p className="masthead-aside">{t('aside')}</p>
      </div>
      <div className="masthead-art" aria-hidden="true"><img className="mirror-art" src={mirrorArtwork} alt="" /></div>
    </header>

    <form className="input-panel" onSubmit={handleSubmit}>
      <div className="input-tabs" aria-label={t('inputType')}>
        <button type="button" className={`input-tab ${type === 'text' ? 'active' : ''}`} aria-pressed={type === 'text'} onClick={() => { clearResult(); setType('text'); }} disabled={isLoading}><TextIcon />{t('analyzeText')}</button>
        <button type="button" className={`input-tab ${type === 'url' ? 'active' : ''}`} aria-pressed={type === 'url'} onClick={() => { clearResult(); setSelectedPreset(null); setType('url'); }} disabled={isLoading}><LinkIcon />{t('analyzeUrl')}</button>
      </div>
      <DemoPresets language={language} disabled={isLoading} onSelect={loadPreset} />
      {selectedPreset && <aside className="preset-attribution">
        <p role="status">{t('presetLoaded', { title: selectedPreset.locales[selectedPreset.selectedLanguage].title })}</p>
        <p>{t(selectedPreset.kind)} · <bdi>{selectedPreset.reference}</bdi></p>
        <p dir="auto" lang={selectedPreset.selectedLanguage}>{selectedPreset.locales[selectedPreset.selectedLanguage].attribution}</p>
        <SourceLinks sources={selectedPreset.sources} language={language} />
      </aside>}
      {result && <div className="view-switch" role="group" aria-label={t('sourceView')}>
        <button type="button" aria-pressed={view === 'edit'} onClick={() => setView('edit')}>{t('edit')}</button>
        <button type="button" aria-pressed={view === 'highlights'} onClick={() => setView('highlights')}>{t('highlights')}</button>
      </div>}
      {view === 'highlights' && result ? <HighlightedText result={result} language={language} /> : type === 'text' ? <>
        <label className="sr-only" htmlFor="analysis-text">{t('textLabel')}</label>
        <textarea id="analysis-text" value={text} dir="auto" onChange={(event) => { clearResult(); setSelectedPreset(null); setText(event.target.value); }} placeholder={t('placeholder')} disabled={isLoading} />
      </> : <>
        <label className="sr-only" htmlFor="analysis-url">{t('urlLabel')}</label>
        <input id="analysis-url" type="url" value={url} dir="ltr" onChange={(event) => { clearResult(); setSelectedPreset(null); setUrl(event.target.value); }} placeholder="https://example.com/article" disabled={isLoading} />
      </>}
      {supportsReasoning && <div className="reasoning-options">
        <div className="reasoning-copy"><label htmlFor="reasoning-effort">{t('reasoning')} <span>· <bdi>Grok 4.7</bdi></span></label><p id="reasoning-description">{t('reasoningHint')}</p></div>
        <select id="reasoning-effort" value={reasoningEffort} onChange={(event) => setReasoningEffort(event.target.value)} disabled={isLoading} aria-describedby="reasoning-description">
          <option value="">{t('default')}</option><option value="low">{t('fast')}</option><option value="medium">{t('balanced')}</option><option value="high">{t('deep')}</option>
        </select>
      </div>}
      <div className="form-footer"><p>{t(type === 'text' ? 'textHint' : 'urlHint')}</p><button className="analyze-button" type="submit" disabled={isLoading}>{t(isLoading ? 'analyzing' : 'analyze')}</button></div>
      {isLoading && <p className="form-message" role="status">{t('loading')}</p>}
      {error && <p className="form-message error" role="alert" dir="auto" lang={error.language || language}>{error.key ? t(error.key) : error.message}</p>}
    </form>
    <Results result={result} isLoading={isLoading} language={language} />
  </main>;
}
