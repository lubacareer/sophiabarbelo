// A separately named correspondence system. The canonical source graphs stay intact.
// Transcribed from 777 (1909), Table I, columns II, VII, XII and XIV, rows 1–32.
const L = (en, he, ru) => ({ en, he, ru });
export const correspondenceSystem = L('Hermetic correspondences · 777 (1909)', 'הקבלות הרמטיות · 777 (1909)', 'Герметические соответствия · 777 (1909)');
const sourceUrl = 'https://keepsilence.org/the-equinox/777/table-of-correspondences_low.pdf';
const sefirot = ['keter', 'chokhmah', 'binah', 'chesed', 'gevurah', 'tiferet', 'netzach', 'hod', 'yesod', 'malkhut'];
const planets = [
  ['saturn', '♄', 'Saturn', 'שבתאי', 'Сатурн'], ['jupiter', '♃', 'Jupiter', 'צדק', 'Юпитер'],
  ['mars', '♂', 'Mars', 'מאדים', 'Марс'], ['sun', '☉', 'Sun', 'שמש', 'Солнце'],
  ['venus', '♀', 'Venus', 'נוגה', 'Венера'], ['mercury', '☿', 'Mercury', 'כוכב חמה', 'Меркурий'],
  ['moon', '☽', 'Moon', 'ירח', 'Луна'],
];
const zodiac = [
  ['aries', '♈', 'Aries', 'טלה', 'Овен'], ['taurus', '♉', 'Taurus', 'שור', 'Телец'],
  ['gemini', '♊', 'Gemini', 'תאומים', 'Близнецы'], ['cancer', '♋', 'Cancer', 'סרטן', 'Рак'],
  ['leo', '♌', 'Leo', 'אריה', 'Лев'], ['virgo', '♍', 'Virgo', 'בתולה', 'Дева'],
  ['libra', '♎', 'Libra', 'מאזניים', 'Весы'], ['scorpio', '♏', 'Scorpio', 'עקרב', 'Скорпион'],
  ['sagittarius', '♐', 'Sagittarius', 'קשת', 'Стрелец'], ['capricorn', '♑', 'Capricorn', 'גדי', 'Козерог'],
  ['aquarius', '♒', 'Aquarius', 'דלי', 'Водолей'], ['pisces', '♓', 'Pisces', 'דגים', 'Рыбы'],
];
const elements = [
  ['air', '🜁', 'Air', 'אוויר', 'Воздух'], ['water', '▽', 'Water', 'מים', 'Вода'], ['fire', '△', 'Fire', 'אש', 'Огонь'],
];
const symbol = (kind, [id, glyph, en, he, ru]) => ({ id: `${kind}-${id}`, kind, glyph: glyph + '\uFE0E', label: L(en, he, ru) });
const celestialSymbols = [...planets.map((item) => symbol('planet', item)), ...zodiac.map((item) => symbol('zodiac', item)), ...elements.map((item) => symbol('element', item))];
// key-scale row, endpoints, Hebrew letter, Tarot name/translation, astrological symbol.
const pathRows = [
  [11, 1, 2, 'א', 'fool', 'The Fool', 'השוטה', 'Шут', 'element-air'],
  [12, 1, 3, 'ב', 'magician', 'The Magician', 'הקוסם', 'Маг', 'planet-mercury', 'The Juggler'],
  [13, 1, 6, 'ג', 'high-priestess', 'The High Priestess', 'הכוהנת הגדולה', 'Верховная Жрица', 'planet-moon'],
  [14, 2, 3, 'ד', 'empress', 'The Empress', 'הקיסרית', 'Императрица', 'planet-venus'],
  [15, 2, 6, 'ה', 'emperor', 'The Emperor', 'הקיסר', 'Император', 'zodiac-aries'],
  [16, 2, 4, 'ו', 'hierophant', 'The Hierophant', 'הכוהן הגדול', 'Иерофант', 'zodiac-taurus'],
  [17, 3, 6, 'ז', 'lovers', 'The Lovers', 'האוהבים', 'Влюблённые', 'zodiac-gemini'],
  [18, 3, 5, 'ח', 'chariot', 'The Chariot', 'המרכבה', 'Колесница', 'zodiac-cancer'],
  [19, 4, 5, 'ט', 'strength', 'Strength', 'עוצמה', 'Сила', 'zodiac-leo'],
  [20, 4, 6, 'י', 'hermit', 'The Hermit', 'הנזיר', 'Отшельник', 'zodiac-virgo', 'Hermit'],
  [21, 4, 7, 'כ', 'wheel-of-fortune', 'Wheel of Fortune', 'גלגל המזל', 'Колесо Фортуны', 'planet-jupiter'],
  [22, 5, 6, 'ל', 'justice', 'Justice', 'צדק', 'Правосудие', 'zodiac-libra'],
  [23, 5, 8, 'מ', 'hanged-man', 'The Hanged Man', 'התלוי', 'Повешенный', 'element-water'],
  [24, 6, 7, 'נ', 'death', 'Death', 'מוות', 'Смерть', 'zodiac-scorpio'],
  [25, 6, 9, 'ס', 'temperance', 'Temperance', 'מזג', 'Умеренность', 'zodiac-sagittarius'],
  [26, 6, 8, 'ע', 'devil', 'The Devil', 'השטן', 'Дьявол', 'zodiac-capricorn'],
  [27, 7, 8, 'פ', 'tower', 'The Tower', 'המגדל', 'Башня', 'planet-mars', 'The House of God'],
  [28, 7, 9, 'צ', 'star', 'The Star', 'הכוכב', 'Звезда', 'zodiac-aquarius'],
  [29, 7, 10, 'ק', 'moon', 'The Moon', 'הירח', 'Луна', 'zodiac-pisces'],
  [30, 8, 9, 'ר', 'sun', 'The Sun', 'השמש', 'Солнце', 'planet-sun'],
  [31, 8, 10, 'ש', 'judgement', 'Judgement', 'יום הדין', 'Суд', 'element-fire', 'The Angel or Last Judgement'],
  [32, 9, 10, 'ת', 'world', 'The World', 'העולם', 'Мир', 'planet-saturn', 'The Universe'],
];
export const correspondenceSources = {};
function source(id, row, column, excerpt) {
  correspondenceSources[id] = {
    title: '777 (1909)', witness: 'Original edition · Table I', reference: `Key scale ${row} · columns ${column}`,
    language: 'en', excerpt, context: excerpt, translator: 'Aleister Crowley · original English',
    rights: 'Public-domain historical text (1909)', rightsUrl: sourceUrl, url: sourceUrl, snapshot: '2026-11-02',
  };
  return id;
}
const invitation = L(
  'Follow this connection as an invitation to explore. What resonates with your own experience, intuition, or another tradition?',
  'אפשר לעקוב אחר הקשר כהזמנה לחקירה. מה מהדהד בחוויה האישית, באינטואיציה או במסורת אחרת?',
  'Исследуйте эту связь как приглашение к размышлению. Что откликается вашему опыту, интуиции или другой традиции?',
);
export const correspondencePaths = pathRows.map(([order, from, to, letter, slug, en, he, ru, astrologyId, historicalName = en]) => {
  const astrology = celestialSymbols.find(({ id }) => id === astrologyId);
  const label = L(en, he, ru);
  return {
    id: `hermetic-path-${order}`, kind: 'correspondence', order, from: sefirot[from - 1], to: sefirot[to - 1],
    letter, tarotId: `tarot-${slug}`, astrologyId, astrology, label, glyph: letter,
    system: correspondenceSystem, historicalName,
    summary: L(`In 777 (1909), this path brings ${en} into conversation with ${astrology.label.en}.`,
      `ב־777 (1909), נתיב זה מפגיש בין ${he} לבין ${astrology.label.he}.`,
      `В 777 (1909) этот путь связывает «${ru}» и ${astrology.label.ru}.`),
    interpretation: invitation,
    sourceIds: [source(`777-path-${order}`, order, 'II, VII, XII, XIV', historicalName)],
  };
});
export const correspondenceSymbols = [
  ...pathRows.map(([, , , letter, slug, en, he, ru]) => ({ id: `tarot-${slug}`, kind: 'tarot', glyph: letter, label: L(en, he, ru) })),
  ...celestialSymbols.filter(({ kind }) => kind !== 'element'),
];
const spheres = [
  ['primum-mobile', '✧', L('Primum Mobile', 'התנועה הראשונית', 'Перводвигатель'), 'Sphere of the Primum Mobile'],
  ['zodiac', '☸', L('Zodiac / fixed stars', 'גלגל המזלות / כוכבי השבת', 'Зодиак / неподвижные звёзды'), 'Sphere of the Zodiac or Fixed Stars'],
  ...planets.map(([id, glyph, en, he, ru]) => [id, glyph, L(en, he, ru), `Sphere of ${id === 'sun' ? 'Sol' : id === 'moon' ? 'Luna' : en}`]),
  ['elements', '◇', L('Elements', 'היסודות', 'Стихии'), 'Sphere of the Elements'],
];
export const celestialAssociations = spheres.map(([slug, glyph, label, excerpt], index) => ({
  id: `hermetic-sphere-${index + 1}`, kind: 'association', order: index + 1, parentId: sefirot[index], glyph: glyph + '\uFE0E', label,
  symbolId: planets.some(([id]) => id === slug) ? `planet-${slug}` : null, system: correspondenceSystem,
  summary: L(`Explore ${label.en} alongside this sefirah through the correspondence in 777 (1909).`,
    `אפשר לחקור את ${label.he} לצד ספירה זו דרך ההקבלה שב־777 (1909).`,
    `Исследуйте «${label.ru}» рядом с этой сфирой через соответствие в 777 (1909).`),
  interpretation: invitation, sourceIds: [source(`777-sphere-${index + 1}`, index + 1, 'II, VII', excerpt)],
}));
const byId = new Map([...correspondencePaths, ...celestialAssociations].map((record) => [record.id, record]));
export function getCorrespondence(id) { return byId.get(id); }
export function correspondenceLabel(record, language = 'en', overlays = { tarot: true }) {
  const name = (value) => value?.[language] || value?.en || '';
  if (record.kind !== 'correspondence') return name(record.label);
  return [overlays.tarot && name(record.label), overlays.astrology && name(record.astrology.label)].filter(Boolean).join(' · ') || name(record.label);
}
