import { useEffect, useId, useRef, useState } from 'react';
import { traditions, localize } from './catalog.js';
import { correspondenceSymbols } from './correspondences.js';
import { exportPersonalConnections, importPersonalConnections, newPersonalConnectionId, personalEndpointLabel, PERSONAL_LIMITS, validatePersonalConnections } from './personal.js';
import './personal.css';

const copy = {
  en: {
    missing: 'This connection was removed while you were editing. Your draft is still here.',
    title: 'Your connections', intro: 'Follow a resonance, a symbol, or your own intuition. These connections belong to your reading.',
    privacy: 'Saved only in this browser on this site. Nothing here is sent to the analysis models. Export a copy to keep it or move it to another browser.',
    empty: 'What speaks to you? Connect a figure to another figure, a symbol, or a name of your own.', add: 'Make a connection', edit: 'Edit', remove: 'Delete', confirmDelete: 'Delete this connection?', confirm: 'Delete connection', cancel: 'Cancel',
    from: 'Start with a figure', targetKind: 'Connect to', entity: 'Another figure', symbol: 'A symbol', custom: 'Your own name', targetEntity: 'Choose a figure', targetSymbol: 'Choose a symbol', customLabel: 'Name your connection’s destination', label: 'Connection name', note: 'Your reflection', optional: 'Optional', save: 'Save connection', editing: 'Edit your connection', creating: 'A new connection',
    export: 'Export connections', import: 'Import connections', importing: 'Reading file…', saved: 'Connection saved.', deleted: 'Connection deleted.', imported: 'Connections imported. Existing connections were kept.', duplicate: 'These connections are already here.', exported: 'Your connections were exported.', count: '{count} of 100 connections', open: 'Explore connection', visit: 'Visit {name}', tarot: 'Tarot', zodiac: 'Zodiac', planet: 'Planets',
    storage: 'Browser storage is unavailable. Your connections remain in this session; export them before leaving.', invalidStorage: 'The saved collection could not be read and has not been erased. New connections remain in this session until you explicitly save them.',
    invalid: 'This file is not a valid collection of personal connections.', json: 'Choose a valid JSON export of personal connections.', version: 'This export uses an unsupported version.', size: 'The collection must fit within 256 KiB.', limit: 'You can keep up to 100 connections. Export a copy before removing any.', text: 'Use a name of up to 80 characters and a reflection of up to 2,000 characters.', endpoint: 'Choose a figure or symbol from the available options.', id: 'The collection contains invalid or repeated connection IDs.', self: 'Choose a different destination for this connection.', conflict: 'An imported ID already belongs to a different connection. Nothing was changed.', file: 'The file could not be read. Please try again.', download: 'The export could not be created. Your connections are still here.',
  },
  he: {
    missing: 'הקשר הזה הוסר בזמן העריכה. הטיוטה שלכם עדיין כאן.',
    title: 'הקשרים שלכם', intro: 'לכו בעקבות הדהוד, סמל או האינטואיציה שלכם. הקשרים האלה שייכים לקריאה האישית שלכם.',
    privacy: 'נשמר רק בדפדפן הזה ובאתר הזה. דבר מכאן אינו נשלח למודלי הניתוח. יצאו עותק כדי לשמור אותו או להעבירו לדפדפן אחר.',
    empty: 'מה מדבר אליכם? חברו דמות לדמות אחרת, לסמל או לשם משלכם.', add: 'יצירת קשר', edit: 'עריכה', remove: 'מחיקה', confirmDelete: 'למחוק את הקשר הזה?', confirm: 'מחיקת הקשר', cancel: 'ביטול',
    from: 'בחרו דמות להתחלה', targetKind: 'לחבר אל', entity: 'דמות אחרת', symbol: 'סמל', custom: 'שם משלכם', targetEntity: 'בחירת דמות', targetSymbol: 'בחירת סמל', customLabel: 'שם ליעד הקשר שלכם', label: 'שם הקשר', note: 'המחשבות שלכם', optional: 'לבחירתכם', save: 'שמירת הקשר', editing: 'עריכת הקשר שלכם', creating: 'קשר חדש',
    export: 'ייצוא הקשרים', import: 'ייבוא הקשרים', importing: 'קורא את הקובץ…', saved: 'הקשר נשמר.', deleted: 'הקשר נמחק.', imported: 'הקשרים יובאו. הקשרים הקיימים נשמרו.', duplicate: 'הקשרים האלה כבר נמצאים כאן.', exported: 'הקשרים שלכם יוצאו.', count: '{count} מתוך 100 קשרים', open: 'עיון בקשר', visit: 'מעבר אל {name}', tarot: 'טארוט', zodiac: 'מזלות', planet: 'כוכבי לכת',
    storage: 'האחסון בדפדפן אינו זמין. הקשרים נשארים בהפעלה הנוכחית; יצאו אותם לפני היציאה.', invalidStorage: 'לא ניתן לקרוא את האוסף השמור, והוא לא נמחק. קשרים חדשים נשארים בהפעלה הנוכחית עד שתשמרו אותם במפורש.',
    invalid: 'הקובץ אינו אוסף תקין של קשרים אישיים.', json: 'בחרו קובץ JSON תקין שיוצא מאוסף קשרים אישיים.', version: 'גרסת הייצוא הזו אינה נתמכת.', size: 'גודל האוסף צריך להיות עד 256 KiB.', limit: 'ניתן לשמור עד 100 קשרים. יצאו עותק לפני מחיקת קשרים.', text: 'השתמשו בשם באורך של עד 80 תווים ובמחשבות באורך של עד 2,000 תווים.', endpoint: 'בחרו דמות או סמל מהאפשרויות הזמינות.', id: 'האוסף מכיל מזהי קשרים לא תקינים או כפולים.', self: 'בחרו יעד אחר לקשר הזה.', conflict: 'מזהה מיובא כבר שייך לקשר אחר. דבר לא שונה.', file: 'לא ניתן לקרוא את הקובץ. נסו שוב.', download: 'לא ניתן ליצור את קובץ הייצוא. הקשרים שלכם עדיין כאן.',
  },
  ru: {
    missing: 'Эта связь была удалена во время редактирования. Ваш черновик остался здесь.',
    title: 'Ваши связи', intro: 'Следуйте созвучиям, символам и собственной интуиции. Эти связи принадлежат вашему прочтению.',
    privacy: 'Сохраняется только в этом браузере на этом сайте. Ничего отсюда не отправляется моделям анализа. Экспортируйте копию, чтобы сохранить её или перенести в другой браузер.',
    empty: 'Что откликается вам? Соедините фигуру с другой фигурой, символом или собственным именем.', add: 'Создать связь', edit: 'Изменить', remove: 'Удалить', confirmDelete: 'Удалить эту связь?', confirm: 'Удалить связь', cancel: 'Отмена',
    from: 'Начните с фигуры', targetKind: 'Связать с', entity: 'Другой фигурой', symbol: 'Символом', custom: 'Собственным именем', targetEntity: 'Выберите фигуру', targetSymbol: 'Выберите символ', customLabel: 'Название другого конца связи', label: 'Название связи', note: 'Ваши размышления', optional: 'Необязательно', save: 'Сохранить связь', editing: 'Изменить вашу связь', creating: 'Новая связь',
    export: 'Экспорт связей', import: 'Импорт связей', importing: 'Чтение файла…', saved: 'Связь сохранена.', deleted: 'Связь удалена.', imported: 'Связи импортированы. Существующие связи сохранены.', duplicate: 'Эти связи уже здесь.', exported: 'Ваши связи экспортированы.', count: '{count} из 100 связей', open: 'Рассмотреть связь', visit: 'Перейти к {name}', tarot: 'Таро', zodiac: 'Зодиак', planet: 'Планеты',
    storage: 'Хранилище браузера недоступно. Связи остаются в текущем сеансе; экспортируйте их перед выходом.', invalidStorage: 'Не удалось прочитать сохранённую коллекцию; она не удалена. Новые связи остаются в текущем сеансе, пока вы явно их не сохраните.',
    invalid: 'Этот файл не является допустимой коллекцией личных связей.', json: 'Выберите корректный JSON-файл экспорта личных связей.', version: 'Версия этого экспорта не поддерживается.', size: 'Размер коллекции не должен превышать 256 КиБ.', limit: 'Можно хранить до 100 связей. Экспортируйте копию перед удалением.', text: 'Название может содержать до 80 символов, а размышление — до 2 000.', endpoint: 'Выберите фигуру или символ из доступных вариантов.', id: 'В коллекции есть недопустимые или повторяющиеся идентификаторы связей.', self: 'Выберите для этой связи другое назначение.', conflict: 'Импортируемый идентификатор уже принадлежит другой связи. Ничего не изменено.', file: 'Не удалось прочитать файл. Попробуйте снова.', download: 'Не удалось создать экспорт. Ваши связи всё ещё здесь.',
  },
};

export const personalMessages = copy;
const entityValue = (endpoint) => endpoint.traditionId + '/' + endpoint.nodeId;
const parseEntity = (value) => { const [traditionId, nodeId] = value.split('/'); return { kind: 'entity', traditionId, nodeId }; };
const allEntities = traditions.flatMap((item) => item.nodes.map((node) => ({ kind: 'entity', traditionId: item.id, nodeId: node.id })));

function makeDraft(record, tradition, selectedNode, language) {
  const base = traditions.find(({ id }) => id === tradition?.id) || traditions[0];
  const from = record?.from || { kind: 'entity', traditionId: base.id, nodeId: base.nodes.some(({ id }) => id === selectedNode?.id) ? selectedNode.id : base.defaultNode };
  const fallbackTarget = allEntities.find((item) => entityValue(item) !== entityValue(from));
  return { id: record?.id || null, from: entityValue(from), targetKind: record?.to.kind || 'entity',
    targetEntity: entityValue(record?.to.kind === 'entity' ? record.to : fallbackTarget),
    targetSymbol: record?.to.kind === 'symbol' ? record.to.symbolId : correspondenceSymbols[0]?.id || '',
    targetCustom: record?.to.kind === 'custom' ? record.to.label : '',
    label: record?.label || `${personalEndpointLabel(from, language)} ↔ ${personalEndpointLabel(fallbackTarget, language)}`.slice(0, PERSONAL_LIMITS.labelChars), note: record?.note || '' };
}

function EntityOptions({ language }) {
  return traditions.map((item) => <optgroup key={item.id} label={localize(item.title, language)}>
    {item.nodes.map((node) => <option key={node.id} value={item.id + '/' + node.id}>{personalEndpointLabel({ kind: 'entity', traditionId: item.id, nodeId: node.id }, language)}</option>)}
  </optgroup>);
}

export default function PersonalConnections({ language = 'en', connections = [], onChange, selectedNode, tradition, onNavigate, onSelectConnection, selectedConnectionId, editingId = null, onEditingFinished, storageWarning = null }) {
  const id = useId();
  const messages = copy[language] || copy.en;
  const t = (key, values = {}) => (messages[key] || messages.invalid).replace(/\{(\w+)\}/gu, (match, key) => String(values[key] ?? match));
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef(null);
  const formHeadingRef = useRef(null);
  const addRef = useRef(null);
  const latestConnections = useRef(connections);
  latestConnections.current = connections;
  const latestEditorContext = useRef({ tradition, selectedNode, language });
  latestEditorContext.current = { tradition, selectedNode, language };
  const update = (field, value) => setDraft((previous) => ({ ...previous, [field]: value }));

  useEffect(() => {
    if (!editingId) return;
    const record = latestConnections.current.find(({ id }) => id === editingId);
    if (!record) return;
    const context = latestEditorContext.current;
    setDraft(makeDraft(record, context.tradition, context.selectedNode, context.language));
    setError(null); setStatus(null); setDeleting(null);
    const frame = requestAnimationFrame(() => formHeadingRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [editingId]);

  function start(record) {
    setDraft(makeDraft(record, tradition, selectedNode, language)); setError(null); setStatus(null); setDeleting(null);
    requestAnimationFrame(() => formHeadingRef.current?.focus({ preventScroll: true }));
  }
  function stopEditing() {
    setDraft(null); setError(null); onEditingFinished?.();
    requestAnimationFrame(() => addRef.current?.focus({ preventScroll: true }));
  }
  function save(event) {
    event.preventDefault();
    try {
      const record = { id: draft.id || newPersonalConnectionId(), from: parseEntity(draft.from),
        to: draft.targetKind === 'entity' ? parseEntity(draft.targetEntity) : draft.targetKind === 'symbol' ? { kind: 'symbol', symbolId: draft.targetSymbol } : { kind: 'custom', label: draft.targetCustom.trim() },
        label: draft.label.trim(), note: draft.note };
      const current = latestConnections.current;
      if (draft.id && !current.some(({ id }) => id === draft.id)) { setError('missing'); return; }
      const next = validatePersonalConnections(draft.id ? current.map((item) => item.id === draft.id ? record : item) : [...current, record]);
      onChange(next); setStatus('saved'); stopEditing();
    } catch (failure) { setError(failure.code || 'invalid'); }
  }
  function remove(connectionId) {
    onChange(latestConnections.current.filter(({ id }) => id !== connectionId));
    if (draft?.id === connectionId) { setDraft(null); onEditingFinished?.(); }
    setDeleting(null); setError(null); setStatus('deleted');
  }
  async function readFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null); setStatus(null); setImporting(true);
    try {
      if (file.size > PERSONAL_LIMITS.fileBytes) { setError('size'); return; }
      const serialized = await file.text();
      const current = latestConnections.current;
      const next = importPersonalConnections(serialized, current);
      if (next.length === current.length) setStatus('duplicate');
      else { onChange(next); setStatus('imported'); }
    } catch (failure) { setError(failure.code || 'file'); }
    finally { setImporting(false); }
  }
  function download() {
    let url;
    try {
      const blob = new Blob([exportPersonalConnections(latestConnections.current)], { type: 'application/json' });
      url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'pleroma-personal-connections.json';
      document.body.append(link); link.click(); link.remove();
      setStatus('exported'); setError(null);
    } catch { setError('download'); }
    finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }

  return <section id="personal-connections-panel" className="personal-connections" aria-labelledby={id + '-title'}>
    <div className="personal-heading"><h2 id={id + '-title'}>{t('title')}</h2><span>{t('count', { count: connections.length })}</span></div>
    <p>{t('intro')}</p>
    <p className="personal-privacy">{t('privacy')}</p>
    {storageWarning && <p className="personal-warning" role="status">{t(storageWarning === 'invalid-storage' ? 'invalidStorage' : 'storage')}</p>}
    <div className="personal-actions">
      <button type="button" ref={addRef} onClick={() => start()} disabled={connections.length >= PERSONAL_LIMITS.connections || !!draft}>{t('add')}</button>
      <button type="button" onClick={download} disabled={!connections.length}>{t('export')}</button>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={importing}>{t(importing ? 'importing' : 'import')}</button>
      <input type="file" ref={inputRef} accept=".json,application/json" aria-label={t('import')} onChange={readFile} hidden />
    </div>
    {error && <p className="personal-error" role="alert">{t(error)}</p>}
    <p className="personal-status" role="status" aria-live="polite">{status ? t(status) : ''}</p>
    {draft && <form className="personal-form" onSubmit={save} aria-labelledby={id + '-form-title'}>
      <h3 id={id + '-form-title'} ref={formHeadingRef} tabIndex={-1}>{t(draft.id ? 'editing' : 'creating')}</h3>
      <label htmlFor={id + '-from'}>{t('from')}<select id={id + '-from'} value={draft.from} onChange={(event) => update('from', event.target.value)}><EntityOptions language={language} /></select></label>
      <label htmlFor={id + '-target-kind'}>{t('targetKind')}<select id={id + '-target-kind'} value={draft.targetKind} onChange={(event) => update('targetKind', event.target.value)}>{['entity', 'symbol', 'custom'].map((kind) => <option key={kind} value={kind}>{t(kind)}</option>)}</select></label>
      {draft.targetKind === 'entity' && <label htmlFor={id + '-target-entity'}>{t('targetEntity')}<select id={id + '-target-entity'} value={draft.targetEntity} onChange={(event) => update('targetEntity', event.target.value)}><EntityOptions language={language} /></select></label>}
      {draft.targetKind === 'symbol' && <label htmlFor={id + '-target-symbol'}>{t('targetSymbol')}<select id={id + '-target-symbol'} value={draft.targetSymbol} onChange={(event) => update('targetSymbol', event.target.value)}>{['tarot', 'zodiac', 'planet'].map((kind) => <optgroup key={kind} label={t(kind)}>{correspondenceSymbols.filter((symbol) => symbol.kind === kind).map((symbol) => <option key={symbol.id} value={symbol.id}>{localize(symbol.label, language)}</option>)}</optgroup>)}</select></label>}
      {draft.targetKind === 'custom' && <label htmlFor={id + '-target-custom'}>{t('customLabel')}<input id={id + '-target-custom'} value={draft.targetCustom} onChange={(event) => update('targetCustom', event.target.value)} maxLength={PERSONAL_LIMITS.labelChars} required dir="auto" /></label>}
      <label htmlFor={id + '-label'}>{t('label')}<input id={id + '-label'} value={draft.label} onChange={(event) => update('label', event.target.value)} maxLength={PERSONAL_LIMITS.labelChars} required dir="auto" /></label>
      <label htmlFor={id + '-note'}>{t('note')} <span className="personal-optional">({t('optional')})</span><textarea id={id + '-note'} value={draft.note} onChange={(event) => update('note', event.target.value)} maxLength={PERSONAL_LIMITS.noteChars} rows={4} dir="auto" /></label>
      <div className="personal-actions"><button type="submit" disabled={importing}>{t('save')}</button><button type="button" onClick={stopEditing}>{t('cancel')}</button></div>
    </form>}
    {!connections.length && !draft && <p className="personal-empty">{t('empty')}</p>}
    <ul className="personal-list">{connections.map((record) => <li key={record.id} data-personal-connection={record.id}>
      <button type="button" className="personal-select" aria-pressed={selectedConnectionId === record.id} onClick={() => onSelectConnection?.(record.id)} aria-label={t('open') + ': ' + record.label}><strong dir="auto">{record.label}</strong><span dir="auto">{personalEndpointLabel(record.from, language)} ↔ {personalEndpointLabel(record.to, language)}</span></button>
      {record.note && <p className="personal-note" dir="auto">{record.note}</p>}
      <div className="personal-actions personal-record-actions">
        {[record.from, record.to].filter((endpoint) => endpoint.kind === 'entity').map((endpoint) => <button key={entityValue(endpoint)} type="button" onClick={() => onNavigate?.({ tradition: endpoint.traditionId, node: endpoint.nodeId })}>{t('visit', { name: personalEndpointLabel(endpoint, language) })}</button>)}
        <button type="button" onClick={() => start(record)} disabled={!!draft}>{t('edit')}</button>
        <button type="button" onClick={() => setDeleting(record.id)} disabled={deleting === record.id}>{t('remove')}</button>
      </div>
      {deleting === record.id && <div className="personal-delete-confirm"><p>{t('confirmDelete')}</p><div className="personal-actions"><button type="button" onClick={() => remove(record.id)}>{t('confirm')}</button><button type="button" onClick={() => setDeleting(null)}>{t('cancel')}</button></div></div>}
    </li>)}</ul>
  </section>;
}
