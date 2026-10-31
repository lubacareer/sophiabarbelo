import { useEffect, useState } from 'react';
import mirrorArtwork from './assets/sophia-mirror.png';

const statusLabels = {
  supported: 'Supported',
  contradicted: 'Contradicted',
  mixed: 'Mixed evidence',
  unverified: 'Unverified',
};

function TextIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" /></svg>;
}

function LinkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 4.3l-1.7 1.8M14 11a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 19.7l1.7-1.8" /></svg>;
}

function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function ClaimCard({ claim }) {
  const status = statusLabels[claim.status] ? claim.status : 'unverified';
  const sources = Array.isArray(claim.sources) ? claim.sources.filter((source) => safeSourceUrl(source.url)) : [];
  return (
    <article className="finding">
      <div className="finding-heading">
        <h3>{claim.claim}</h3>
        <span className={`status status-${status}`}>{statusLabels[status]}</span>
      </div>
      {claim.excerpt && claim.excerpt !== claim.claim && <blockquote className="claim-excerpt">“{claim.excerpt}”</blockquote>}
      <p>{claim.explanation}</p>
      {sources.length > 0 && (
        <div className="sources">
          <span>Sources:</span>
          <ul>
            {sources.map((source, index) => (
              <li key={`${source.url}-${index}`}>
                <a href={safeSourceUrl(source.url)} target="_blank" rel="noopener noreferrer">{source.title || source.url}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function RhetoricCard({ observation }) {
  return (
    <article className="finding rhetoric-finding">
      <h3>{observation.category}</h3>
      {observation.excerpt && <blockquote>“{observation.excerpt}”</blockquote>}
      <p>{observation.explanation}</p>
    </article>
  );
}

function Results({ result, isLoading }) {
  const claims = result?.claims ?? [];
  const rhetoric = result?.rhetoric ?? [];
  return (
    <section className="analysis" aria-labelledby="analysis-heading" aria-busy={isLoading}>
      <h2 id="analysis-heading">Analysis</h2>
      <p className="section-intro">Key factual claims and rhetorical techniques, with evidence and context.</p>
      <div className="results-grid">
        <section className="result-panel claims-panel" aria-labelledby="claims-heading">
          <h2 id="claims-heading">Factual claims</h2>
          <p className="panel-intro">Checkable statements from the text, with evidence and uncertainty.</p>
          {claims.length ? claims.map((claim, index) => <ClaimCard key={index} claim={claim} />) : (
            <p className="empty-state">{result ? 'No checkable claims were identified.' : 'Claims and supporting sources will appear here after analysis.'}</p>
          )}
        </section>
        <section className="result-panel rhetoric-panel" aria-labelledby="rhetoric-heading">
          <h2 id="rhetoric-heading">Rhetorical analysis</h2>
          <p className="panel-intro">Notable rhetorical techniques, with excerpts and explanation.</p>
          {rhetoric.length ? rhetoric.map((observation, index) => <RhetoricCard key={index} observation={observation} />) : (
            <p className="empty-state">{result ? 'No rhetorical techniques were identified.' : 'Possible rhetorical techniques and their context will appear here.'}</p>
          )}
        </section>
      </div>
      {result?.limitations?.length > 0 && (
        <div className="limitations">
          <h3>Limitations</h3>
          <ul>{result.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>
      )}
      <p className="interpretation-note">Rhetorical observations are interpretations. Evidence can be incomplete, so review the sources and context yourself.</p>
    </section>
  );
}

export default function App() {
  const [type, setType] = useState('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState('');
  const [supportsReasoning, setSupportsReasoning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const endpoint = window.location.pathname.startsWith('/admin/') ? '/admin/api/config' : '/api/config';
    fetch(endpoint, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((config) => setSupportsReasoning(config?.reasoningControls === true))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const content = (type === 'text' ? text : url).trim();
    if (!content) {
      setError(type === 'text' ? 'Enter some text to analyze.' : 'Enter a URL to analyze.');
      return;
    }
    setError('');
    setResult(null);
    setIsLoading(true);
    try {
      // The proxy authenticates requests in the /admin/ protection space.
      const endpoint = window.location.pathname.startsWith('/admin/') ? '/admin/api/analyze' : '/api/analyze';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, ...(reasoningEffort ? { reasoningEffort } : {}) }),
      });
      let data;
      try { data = await response.json(); } catch { throw new Error('The server returned an unexpected response. Please try again.'); }
      if (!response.ok) throw new Error(data.error || 'Analysis failed. Please try again.');
      if (!Array.isArray(data.claims) || !Array.isArray(data.rhetoric)) throw new Error('The analysis response was incomplete. Please try again.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function selectType(nextType) {
    setType(nextType);
    setError('');
  }

  return (
    <main className="shell">
      <header className="masthead">
        <div className="masthead-copy">
          <h1>Sophia’s Mirror</h1>
          <p>Analyze claims. Explore rhetoric. Think more clearly.</p>
          <p className="masthead-aside">Different perspectives. A clearer picture.</p>
        </div>
        <div className="masthead-art" aria-hidden="true">
          <img className="mirror-art" src={mirrorArtwork} alt="" />
        </div>
      </header>

      <form className="input-panel" onSubmit={handleSubmit}>
        <div className="input-tabs" aria-label="Input type">
          <button type="button" className={type === 'text' ? 'input-tab active' : 'input-tab'} aria-pressed={type === 'text'} onClick={() => selectType('text')} disabled={isLoading}><TextIcon /> Analyze text</button>
          <button type="button" className={type === 'url' ? 'input-tab active' : 'input-tab'} aria-pressed={type === 'url'} onClick={() => selectType('url')} disabled={isLoading}><LinkIcon /> Analyze a URL</button>
        </div>
        {type === 'text' ? (
          <>
            <label className="sr-only" htmlFor="analysis-text">Text to analyze</label>
            <textarea id="analysis-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste a news article, speech, or other text here…" disabled={isLoading} />
          </>
        ) : (
          <>
            <label className="sr-only" htmlFor="analysis-url">URL to analyze</label>
            <input id="analysis-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/article" disabled={isLoading} />
          </>
        )}
        {supportsReasoning && <div className="reasoning-options">
          <div className="reasoning-copy">
            <label htmlFor="reasoning-effort">Reasoning depth <span>· Grok 4.7</span></label>
            <p id="reasoning-description">Deeper reasoning may take longer.</p>
          </div>
          <select id="reasoning-effort" value={reasoningEffort} onChange={(event) => setReasoningEffort(event.target.value)} disabled={isLoading} aria-describedby="reasoning-description">
            <option value="">Default</option>
            <option value="low">Fast</option>
            <option value="medium">Balanced</option>
            <option value="high">Deep</option>
          </select>
        </div>}
        <div className="form-footer">
          <p>{type === 'text' ? 'Try a news article, opinion piece, or your own text.' : 'Enter a link to a publicly accessible article.'}</p>
          <button className="analyze-button" type="submit" disabled={isLoading}>{isLoading ? 'Analyzing…' : 'Analyze'}</button>
        </div>
        {isLoading && <p className="form-message" role="status">Researching claims and examining the language. This may take a moment.</p>}
        {error && <p className="form-message error" role="alert">{error}</p>}
      </form>

      <Results result={result} isLoading={isLoading} />
    </main>
  );
}
