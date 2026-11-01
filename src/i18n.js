export const languages = ['en', 'he', 'ru'];
export const languageNames = { en: 'English', he: 'עברית', ru: 'Русский' };
export const localeStorageKey = 'sophia-language';

export const messages = {
  en: {
    language: 'Interface language', tagline: 'Analyze claims. Explore rhetoric. Think more clearly.', aside: 'Different perspectives. A clearer picture.',
    inputType: 'Input type', analyzeText: 'Analyze text', analyzeUrl: 'Analyze a URL', textLabel: 'Text to analyze', urlLabel: 'URL to analyze',
    placeholder: 'Paste a news article, speech, or other text here…', textHint: 'Try a news article, opinion piece, or your own text.', urlHint: 'Enter a link to a publicly accessible article.',
    analyze: 'Analyze', analyzing: 'Analyzing…', loading: 'Researching claims and examining the language. This may take a moment.',
    enterText: 'Enter some text to analyze.', enterUrl: 'Enter a URL to analyze.', unexpected: 'The server returned an unexpected response. Please try again.', failed: 'Analysis failed. Please try again.', incomplete: 'The analysis response was incomplete. Please try again.',
    reasoning: 'Reasoning depth', reasoningHint: 'Deeper reasoning may take longer.', default: 'Default', fast: 'Fast', balanced: 'Balanced', deep: 'Deep',
    analysis: 'Analysis', analysisIntro: 'Key factual claims and rhetorical techniques, with evidence and context.', claims: 'Factual claims', claimsIntro: 'Checkable statements from the text, with evidence and uncertainty.',
    rhetoric: 'Rhetorical analysis', rhetoricIntro: 'Possible rhetorical techniques, with excerpts and explanation.', noClaims: 'No checkable claims were identified.', claimsEmpty: 'Claims and supporting sources will appear here after analysis.',
    noRhetoric: 'No rhetorical techniques were identified.', rhetoricEmpty: 'Possible rhetorical techniques and their context will appear here.', sources: 'Sources', limitations: 'Limitations',
    interpretation: 'Rhetorical observations are interpretations. Evidence can be incomplete, so review the sources and context yourself.',
    supported: 'Supported', contradicted: 'Contradicted', mixed: 'Mixed evidence', unverified: 'Unverified', reasoningFailure: 'Reasoning failure', rhetoricalObservation: 'Rhetorical observation',
    scapegoating: 'Scapegoating (Azazel)', selective_piety: 'Selective in-group piety (Stork Wings)', shame_fear: 'Shame / fear framing', demagogy: 'Demagogy', victim_blaming: 'Victim-blaming / gaslighting', intimidation: 'Intimidation', faulty_reasoning: 'Faulty reasoning', other: 'Other technique',
    demos: 'Try a demo', demosHint: 'Load a passage, then press Analyze. Findings are not predetermined.', ancient: 'Ancient theology', media: 'Modern media / viral news',
    presetLoaded: 'Loaded demo: {title}', reference: 'Reference', excerpt: 'Selected source passage', adaptation: 'Original adaptation — not a quotation',
    sourceView: 'Source view', edit: 'Edit', highlights: 'Highlights', annotatedText: 'Analyzed text with commentary links',
    highlightHint: 'Only passages with commentary are annotated. Follow the numbered links to read each finding.',
    supportedLegend: 'Lilac: supported by cited evidence', problemLegend: 'Red: contradicted claim or explained reasoning failure', neutralLegend: 'Underline: uncertain claim or other rhetorical observation',
    claimShort: 'C', rhetoricShort: 'R', findingLink: '{label}, finding {number}', resultLanguage: 'Analysis language: {language}',
    resultLanguageHint: 'Run Analyze again to write a new analysis in the selected interface language.',
  },
  he: {
    language: 'שפת הממשק', tagline: 'בודקים טענות. בוחנים רטוריקה. חושבים בבהירות.', aside: 'נקודות מבט שונות. תמונה ברורה יותר.',
    inputType: 'סוג הקלט', analyzeText: 'ניתוח טקסט', analyzeUrl: 'ניתוח קישור', textLabel: 'טקסט לניתוח', urlLabel: 'קישור לניתוח',
    placeholder: 'הדביקו כאן כתבה, נאום או טקסט אחר…', textHint: 'אפשר לנסות כתבה, מאמר דעה או טקסט שלכם.', urlHint: 'הזינו קישור למאמר הנגיש לציבור.',
    analyze: 'ניתוח', analyzing: 'מנתח…', loading: 'בודק מקורות לטענות ובוחן את השפה. התהליך עשוי להימשך מעט.',
    enterText: 'הזינו טקסט לניתוח.', enterUrl: 'הזינו קישור לניתוח.', unexpected: 'השרת החזיר תשובה לא צפויה. נסו שוב.', failed: 'הניתוח נכשל. נסו שוב.', incomplete: 'תשובת הניתוח אינה שלמה. נסו שוב.',
    reasoning: 'עומק ההסקה', reasoningHint: 'הסקה מעמיקה יותר עשויה להימשך זמן רב יותר.', default: 'ברירת מחדל', fast: 'מהיר', balanced: 'מאוזן', deep: 'מעמיק',
    analysis: 'ניתוח', analysisIntro: 'טענות עובדתיות ואמצעים רטוריים מרכזיים, עם ראיות והקשר.', claims: 'טענות עובדתיות', claimsIntro: 'אמירות שניתן לבדוק, בצירוף ראיות ואי־ודאות.',
    rhetoric: 'ניתוח רטורי', rhetoricIntro: 'אמצעים רטוריים אפשריים, עם מובאות והסבר.', noClaims: 'לא זוהו טענות שניתן לבדוק.', claimsEmpty: 'טענות ומקורות תומכים יופיעו כאן לאחר הניתוח.',
    noRhetoric: 'לא זוהו אמצעים רטוריים.', rhetoricEmpty: 'אמצעים רטוריים אפשריים וההקשר שלהם יופיעו כאן.', sources: 'מקורות', limitations: 'מגבלות',
    interpretation: 'הערות רטוריות הן פרשנויות. הראיות עשויות להיות חלקיות; בדקו בעצמכם את המקורות ואת ההקשר.',
    supported: 'נתמך במקורות', contradicted: 'נסתר במקורות', mixed: 'ראיות מעורבות', unverified: 'לא מאומת', reasoningFailure: 'כשל בהסקה', rhetoricalObservation: 'הערה רטורית',
    scapegoating: 'שעיר לעזאזל (עזאזל)', selective_piety: 'אדיקות סלקטיבית כלפי קבוצת הפנים (כנפי החסידה)', shame_fear: 'מסגור באמצעות בושה או פחד', demagogy: 'דמגוגיה', victim_blaming: 'האשמת הקורבן / ערעור תפיסת המציאות', intimidation: 'הפחדה', faulty_reasoning: 'הסקה לקויה', other: 'אמצעי אחר',
    demos: 'נסו דוגמה', demosHint: 'טענו קטע ולחצו על ניתוח. הממצאים אינם נקבעים מראש.', ancient: 'תאולוגיה עתיקה', media: 'תקשורת מודרנית / חדשות ויראליות',
    presetLoaded: 'הדוגמה שנטענה: {title}', reference: 'הפניה', excerpt: 'קטע נבחר מן המקור', adaptation: 'עיבוד מקורי — לא ציטוט',
    sourceView: 'תצוגת המקור', edit: 'עריכה', highlights: 'הדגשות', annotatedText: 'הטקסט שנותח עם קישורים להערות',
    highlightHint: 'רק קטעים שיש עליהם הערות מסומנים. עקבו אחר הקישורים הממוספרים כדי לקרוא את הממצאים.',
    supportedLegend: 'לילך: נתמך בראיות מצוטטות', problemLegend: 'אדום: טענה שנסתרה או כשל מוסבר בהסקה', neutralLegend: 'קו תחתון: טענה לא ודאית או הערה רטורית אחרת',
    claimShort: 'ט', rhetoricShort: 'ר', findingLink: '{label}, ממצא {number}', resultLanguage: 'שפת הניתוח: {language}',
    resultLanguageHint: 'לחצו שוב על ניתוח כדי לקבל ניתוח חדש בשפת הממשק שנבחרה.',
  },
  ru: {
    language: 'Язык интерфейса', tagline: 'Проверяйте утверждения. Изучайте риторику. Мыслите яснее.', aside: 'Разные точки зрения. Более ясная картина.',
    inputType: 'Тип ввода', analyzeText: 'Анализ текста', analyzeUrl: 'Анализ ссылки', textLabel: 'Текст для анализа', urlLabel: 'Ссылка для анализа',
    placeholder: 'Вставьте статью, речь или другой текст…', textHint: 'Попробуйте новость, авторскую колонку или свой текст.', urlHint: 'Введите ссылку на общедоступную статью.',
    analyze: 'Анализировать', analyzing: 'Анализ…', loading: 'Проверяем источники и изучаем язык текста. Это может занять некоторое время.',
    enterText: 'Введите текст для анализа.', enterUrl: 'Введите ссылку для анализа.', unexpected: 'Сервер вернул неожиданный ответ. Попробуйте снова.', failed: 'Не удалось выполнить анализ. Попробуйте снова.', incomplete: 'Ответ с анализом неполный. Попробуйте снова.',
    reasoning: 'Глубина рассуждения', reasoningHint: 'Более глубокий анализ может занять больше времени.', default: 'По умолчанию', fast: 'Быстро', balanced: 'Сбалансированно', deep: 'Глубоко',
    analysis: 'Анализ', analysisIntro: 'Основные фактические утверждения и риторические приёмы с доказательствами и контекстом.', claims: 'Фактические утверждения', claimsIntro: 'Проверяемые высказывания с доказательствами и указанием неопределённости.',
    rhetoric: 'Риторический анализ', rhetoricIntro: 'Возможные риторические приёмы с цитатами и объяснениями.', noClaims: 'Проверяемые утверждения не найдены.', claimsEmpty: 'После анализа здесь появятся утверждения и источники.',
    noRhetoric: 'Риторические приёмы не найдены.', rhetoricEmpty: 'Здесь появятся возможные риторические приёмы и их контекст.', sources: 'Источники', limitations: 'Ограничения',
    interpretation: 'Риторические наблюдения — это интерпретации. Доказательства могут быть неполными: проверяйте источники и контекст самостоятельно.',
    supported: 'Подтверждено', contradicted: 'Опровергнуто', mixed: 'Неоднозначные данные', unverified: 'Не проверено', reasoningFailure: 'Ошибка рассуждения', rhetoricalObservation: 'Риторическое наблюдение',
    scapegoating: 'Поиск козла отпущения (Азазель)', selective_piety: 'Избирательное благочестие внутри группы (Крылья аиста)', shame_fear: 'Воздействие через стыд или страх', demagogy: 'Демагогия', victim_blaming: 'Обвинение жертвы / газлайтинг', intimidation: 'Запугивание', faulty_reasoning: 'Ошибочное рассуждение', other: 'Другой приём',
    demos: 'Попробуйте пример', demosHint: 'Загрузите отрывок и нажмите «Анализировать». Выводы не заданы заранее.', ancient: 'Древнее богословие', media: 'Современные СМИ / вирусные новости',
    presetLoaded: 'Загружен пример: {title}', reference: 'Ссылка на отрывок', excerpt: 'Отрывок из источника', adaptation: 'Авторская адаптация — не цитата',
    sourceView: 'Вид исходного текста', edit: 'Редактировать', highlights: 'Выделения', annotatedText: 'Проанализированный текст со ссылками на комментарии',
    highlightHint: 'Отмечены только отрывки с комментариями. Перейдите по нумерованным ссылкам, чтобы прочитать выводы.',
    supportedLegend: 'Сиреневый: подтверждено приведёнными источниками', problemLegend: 'Красный: опровергнутое утверждение или объяснённая ошибка рассуждения', neutralLegend: 'Подчёркивание: неопределённость или другое риторическое наблюдение',
    claimShort: 'Ф', rhetoricShort: 'Р', findingLink: '{label}, вывод {number}', resultLanguage: 'Язык анализа: {language}',
    resultLanguageHint: 'Повторите анализ, чтобы получить новый результат на выбранном языке интерфейса.',
  },
};

export function translate(language, key, values = {}) {
  const message = messages[language]?.[key] ?? messages.en[key] ?? key;
  return message.replace(/\{(\w+)\}/g, (match, name) => values[name] === undefined ? match : String(values[name]));
}

export function savedLanguage(storage) {
  try { const value = (storage ?? globalThis.localStorage).getItem(localeStorageKey); return languages.includes(value) ? value : 'en'; }
  catch { return 'en'; }
}
