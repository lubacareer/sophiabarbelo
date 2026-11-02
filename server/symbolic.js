// Symbolic readings are opt-in additions to the existing analysis, never verdicts.
export function symbolicSchema(base, enabled = false) {
  if (!enabled) return base;
  return {
    ...base,
    required: [...base.required, 'symbolicReadings'],
    properties: {
      ...base.properties,
      symbolicReadings: { type: 'array', maxItems: 3, items: {
        type: 'object', additionalProperties: false,
        required: ['excerpt', 'title', 'reading', 'reflectionQuestion', 'basis', 'tradition', 'sources'],
        properties: {
          excerpt: { type: 'string' }, title: { type: 'string' }, reading: { type: 'string' }, reflectionQuestion: { type: 'string' },
          basis: { type: 'string', enum: ['reflection', 'tradition'] }, tradition: { type: 'string' },
          sources: base.properties.claims.items.properties.sources,
        },
      } },
    },
  };
}

export function symbolicResearchInstruction(enabled = false) {
  return enabled ? ` The reader also requests possible symbolic readings. Within the existing research budget, consider relevant archetypal, Tarot, astrological, and other esoteric contexts when the passage invites them. Research a named tradition before attributing a correspondence to it. Keep the passage's substantive assertions central and do not force symbolic connections or treat a symbolic association as evidence for an empirical claim.` : '';
}

export function symbolicAnalysisInstruction(enabled = false) {
  return enabled ? ` Also return symbolicReadings with at most three concise, distinct possibilities grounded in short exact excerpts. Welcome intuitive, archetypal, Tarot, astrological, and other esoteric readings without assuming a single correct interpretation. Each item has excerpt, title, reading, reflectionQuestion, basis, tradition, and sources. For basis reflection, use an empty tradition and sources array, and offer an original possibility rather than attributing it to a historical system. For basis tradition, name the specific system in tradition and cite only relevant URLs reported by the research provider; omit the item if no such source is available. Separate symbolic meaning from checkable factual evidence and rhetorical criticism. Do not present these readings as predictions, personal diagnoses, hidden facts, or conclusions about the reader. Invite reflection with an open question. Do not add factual verdicts to symbolic readings, invent citations, or force a reading when none is useful; an empty array is valid. Write titles, readings, tradition descriptions, and reflection questions in the requested output language, while preserving verbatim excerpts and credited source titles.` : '';
}
