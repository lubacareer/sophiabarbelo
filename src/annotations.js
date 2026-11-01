const claimLabels = new Set(['supported', 'contradicted', 'mixed', 'unverified']);
const tonePriority = { neutral: 0, supported: 1, problem: 2 };

// Repeated excerpts stay highlighted, but each finding needs only one keyboard
// link. Bound controls to the finding count rather than occurrence count.
export function withFindingLinks(segments) {
  const linked = new Set();
  return segments.map((segment) => ({
    ...segment,
    links: segment.findings.filter((finding) => {
      if (linked.has(finding.id)) return false;
      linked.add(finding.id);
      return true;
    }),
  }));
}

/**
 * Split source text into literal, lossless spans annotated with matching findings.
 * Offsets use JavaScript string indices; the source is never normalized or parsed
 * as markup. Repeated and overlapping occurrences all retain their findings.
 */
export function buildAnnotations(sourceText, result) {
  if (typeof sourceText !== 'string' || sourceText.length === 0) return [];

  const events = new Map();
  function boundary(position) {
    if (!events.has(position)) events.set(position, { starts: [], ends: [] });
    return events.get(position);
  }
  boundary(0);
  boundary(sourceText.length);

  let order = 0;
  function addFinding(item, finding, tone) {
    const excerpt = item?.excerpt;
    if (typeof excerpt !== 'string' || !excerpt.trim()) return;
    const annotation = { finding, tone, order: order++ };
    let from = 0;
    while (from <= sourceText.length - excerpt.length) {
      const start = sourceText.indexOf(excerpt, from);
      if (start === -1) break;
      boundary(start).starts.push(annotation);
      boundary(start + excerpt.length).ends.push(annotation);
      from = start + 1;
    }
  }

  const claims = Array.isArray(result?.claims) ? result.claims : [];
  claims.forEach((claim, index) => {
    const labelKey = claimLabels.has(claim?.status) ? claim.status : 'unverified';
    const hasSources = Array.isArray(claim?.sources) && claim.sources.length > 0;
    const tone = hasSources && labelKey === 'supported' ? 'supported'
      : hasSources && labelKey === 'contradicted' ? 'problem' : 'neutral';
    addFinding(claim, { id: `claim-${index}`, kind: 'claim', index, labelKey }, tone);
  });

  const rhetoric = Array.isArray(result?.rhetoric) ? result.rhetoric : [];
  rhetoric.forEach((observation, index) => {
    const isFailure = observation?.isReasoningFlaw === true
      && typeof observation.explanation === 'string' && observation.explanation.trim().length > 0;
    addFinding(observation, {
      id: `rhetoric-${index}`, kind: 'rhetoric', index,
      labelKey: isFailure ? 'reasoningFailure' : 'rhetoricalObservation',
    }, isFailure ? 'problem' : 'neutral');
  });

  const positions = [...events.keys()].sort((a, b) => a - b);
  const active = new Map();
  const segments = [];
  for (let positionIndex = 0; positionIndex < positions.length - 1; positionIndex++) {
    const start = positions[positionIndex];
    const end = positions[positionIndex + 1];
    const event = events.get(start);
    for (const annotation of event.ends) {
      const entry = active.get(annotation.finding.id);
      if (entry.count === 1) active.delete(annotation.finding.id);
      else entry.count--;
    }
    for (const annotation of event.starts) {
      const entry = active.get(annotation.finding.id);
      if (entry) entry.count++;
      else active.set(annotation.finding.id, { annotation, count: 1 });
    }

    const annotations = [...active.values()].map((entry) => entry.annotation).sort((a, b) => a.order - b.order);
    const findings = annotations.map((annotation) => annotation.finding);
    const tone = annotations.reduce((chosen, annotation) => (
      chosen === null || tonePriority[annotation.tone] > tonePriority[chosen] ? annotation.tone : chosen
    ), null);
    const previous = segments.at(-1);
    if (previous && previous.tone === tone && previous.findings.length === findings.length
      && findings.every((finding, index) => finding.id === previous.findings[index].id)) {
      previous.end = end;
    } else {
      segments.push({ start, end, tone, findings });
    }
  }

  return segments.map((segment) => ({ text: sourceText.slice(segment.start, segment.end), ...segment }));
}
