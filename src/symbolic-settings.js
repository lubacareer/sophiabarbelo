export const symbolicStorageKey = 'sophia-symbolic-readings';

export function savedSymbolicSetting(storage) {
  try { return (storage ?? globalThis.localStorage).getItem(symbolicStorageKey) === 'true'; }
  catch { return false; }
}

export function rememberSymbolicSetting(enabled, storage) {
  try { (storage ?? globalThis.localStorage).setItem(symbolicStorageKey, String(enabled === true)); }
  catch { /* The current selection remains usable without browser storage. */ }
}

function safeSource(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source) || typeof source.title !== 'string' || typeof source.url !== 'string') return false;
  try {
    const url = new URL(source.url);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

// Validate at the response boundary so a malformed optional section cannot break
// the result screen. A later setting change must not rewrite an existing result.
export function parseSymbolicResponse(result, requested = false) {
  const { symbolicReadings, ...base } = result;
  if (!requested) return base;
  const invalid = () => { throw new Error('Invalid symbolic readings'); };
  if (typeof result.sourceText !== 'string' || !Array.isArray(symbolicReadings) || symbolicReadings.length > 3) invalid();
  const readings = symbolicReadings.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || !['excerpt', 'title', 'reading', 'reflectionQuestion'].every((field) => typeof item[field] === 'string' && item[field].trim())
      || !result.sourceText.includes(item.excerpt)
      || typeof item.tradition !== 'string'
      || !Array.isArray(item.sources) || item.sources.length > 8 || !item.sources.every(safeSource)) invalid();
    if (item.basis === 'reflection') {
      if (item.tradition !== '' || item.sources.length !== 0) invalid();
    } else if (item.basis !== 'tradition' || !item.tradition.trim() || item.sources.length === 0) invalid();
    return {
      excerpt: item.excerpt, title: item.title, reading: item.reading, reflectionQuestion: item.reflectionQuestion,
      basis: item.basis, tradition: item.tradition, sources: item.sources.map(({ title, url }) => ({ title, url })),
    };
  });
  return { ...base, symbolicReadings: readings };
}
