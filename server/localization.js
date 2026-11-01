export const languages = ['en', 'he', 'ru'];

// English messages remain the internal keys so existing callers and logs retain
// their meaning. Translate only trusted application messages, never source text.
const messages = {
  'Choose a valid interface language.': ['יש לבחור שפת ממשק תקינה.', 'Выберите поддерживаемый язык интерфейса.'],
  'This host is not allowed.': ['הגישה מהמארח הזה אינה מורשית.', 'Доступ с этого хоста запрещён.'],
  'Enter text or a public article URL to analyze.': ['יש להזין טקסט או קישור למאמר ציבורי לניתוח.', 'Введите текст или ссылку на общедоступную статью для анализа.'],
  'Choose a valid reasoning setting.': ['יש לבחור הגדרת העמקה תקינה.', 'Выберите допустимую глубину рассуждения.'],
  'The URL is too long.': ['הקישור ארוך מדי.', 'Ссылка слишком длинная.'],
  'Text must be 30,000 characters or fewer.': ['הטקסט חייב להכיל עד 30,000 תווים.', 'Текст должен содержать не более 30 000 символов.'],
  'The client address could not be verified.': ['לא ניתן לאמת את כתובת הלקוח.', 'Не удалось проверить адрес клиента.'],
  'Too many analyses. Please try again later.': ['בוצעו יותר מדי ניתוחים. יש לנסות שוב מאוחר יותר.', 'Слишком много анализов. Повторите попытку позже.'],
  'The analyzer is busy. Please try again shortly.': ['כלי הניתוח עמוס. יש לנסות שוב בעוד זמן קצר.', 'Сервис анализа занят. Повторите попытку чуть позже.'],
  'The submitted text is too large.': ['הטקסט שנשלח גדול מדי.', 'Отправленный текст слишком большой.'],
  'The request could not be read.': ['לא ניתן לקרוא את הבקשה.', 'Не удалось прочитать запрос.'],
  'Something went wrong. Please try again.': ['אירעה שגיאה. יש לנסות שוב.', 'Произошла ошибка. Повторите попытку.'],
  'Enter a valid public HTTP or HTTPS URL.': ['יש להזין קישור ציבורי תקין מסוג HTTP או HTTPS.', 'Введите допустимую общедоступную ссылку HTTP или HTTPS.'],
  'Only public HTTP or HTTPS URLs on standard ports are supported.': ['נתמכים רק קישורי HTTP או HTTPS ציבוריים ביציאות רגילות.', 'Поддерживаются только общедоступные ссылки HTTP или HTTPS со стандартными портами.'],
  'The URL must point to a public website.': ['הקישור חייב להפנות לאתר ציבורי.', 'Ссылка должна вести на общедоступный сайт.'],
  'The website address could not be resolved.': ['לא ניתן לאתר את כתובת האתר.', 'Не удалось определить адрес сайта.'],
  'The article could not be accessed. Try pasting its text instead.': ['לא ניתן לגשת למאמר. אפשר להדביק את הטקסט שלו במקום זאת.', 'Не удалось открыть статью. Попробуйте вставить её текст.'],
  'The URL must point to an HTML or plain-text article.': ['הקישור חייב להפנות למאמר ב־HTML או בטקסט פשוט.', 'Ссылка должна вести на статью в формате HTML или обычного текста.'],
  'The website returned an unsupported response. Try pasting its text instead.': ['האתר החזיר תגובה שאינה נתמכת. אפשר להדביק את הטקסט במקום זאת.', 'Сайт вернул неподдерживаемый ответ. Попробуйте вставить текст статьи.'],
  'The article is too large to process.': ['המאמר גדול מדי לעיבוד.', 'Статья слишком большая для обработки.'],
  'The article could not be read.': ['לא ניתן לקרוא את המאמר.', 'Не удалось прочитать статью.'],
  'The website redirected too many times or to an invalid address.': ['האתר ביצע יותר מדי הפניות או הפנה לכתובת לא תקינה.', 'Сайт выполнил слишком много перенаправлений или перенаправил на недопустимый адрес.'],
  'The website redirected to an invalid address.': ['האתר הפנה לכתובת לא תקינה.', 'Сайт перенаправил на недопустимый адрес.'],
  'No readable article text was found. Try pasting the text instead.': ['לא נמצא טקסט מאמר שניתן לקריאה. אפשר להדביק את הטקסט במקום זאת.', 'Не найден доступный для чтения текст статьи. Попробуйте вставить текст.'],
  'The article is too long. Please paste up to 30,000 characters.': ['המאמר ארוך מדי. יש להדביק עד 30,000 תווים.', 'Статья слишком длинная. Вставьте не более 30 000 символов.'],
  'The analysis service returned an incomplete result. Please try again.': ['שירות הניתוח החזיר תוצאה חלקית. יש לנסות שוב.', 'Сервис анализа вернул неполный результат. Повторите попытку.'],
  'Analysis is unavailable: configure XAI_API_KEY on the server.': ['הניתוח אינו זמין: יש להגדיר XAI_API_KEY בשרת.', 'Анализ недоступен: настройте XAI_API_KEY на сервере.'],
  'Analysis is unavailable: configure GROQ_API_KEY on the server.': ['הניתוח אינו זמין: יש להגדיר GROQ_API_KEY בשרת.', 'Анализ недоступен: настройте GROQ_API_KEY на сервере.'],
  'The analysis service could not be reached. Please try again.': ['לא ניתן להתחבר לשירות הניתוח. יש לנסות שוב.', 'Не удалось связаться с сервисом анализа. Повторите попытку.'],
  'The analysis service credentials are invalid or do not have access.': ['פרטי הגישה לשירות הניתוח אינם תקינים או חסרי הרשאה.', 'Учётные данные сервиса анализа недействительны или не дают доступа.'],
  'The analysis service is busy or has reached its limit. Please try again later.': ['שירות הניתוח עמוס או הגיע למגבלת השימוש. יש לנסות שוב מאוחר יותר.', 'Сервис анализа занят или достиг лимита. Повторите попытку позже.'],
  'The analysis service could not complete the request. Please try again.': ['שירות הניתוח לא הצליח להשלים את הבקשה. יש לנסות שוב.', 'Сервис анализа не смог выполнить запрос. Повторите попытку.'],
  'Web research is temporarily unavailable. Please try again later.': ['המחקר ברשת אינו זמין כרגע. יש לנסות שוב מאוחר יותר.', 'Поиск в интернете временно недоступен. Повторите попытку позже.'],
  "Groq's usage limit was reached. Please try again later or use a shorter text.": ['הגעת למגבלת השימוש של Groq. יש לנסות שוב מאוחר יותר או להשתמש בטקסט קצר יותר.', 'Достигнут лимит Groq. Повторите попытку позже или используйте более короткий текст.'],
  'This text is too long for the analysis service. Please use a shorter text.': ['הטקסט ארוך מדי לשירות הניתוח. יש להשתמש בטקסט קצר יותר.', 'Этот текст слишком длинный для сервиса анализа. Используйте более короткий текст.'],
  'Analysis is unavailable: the deployment role is not configured.': ['הניתוח אינו זמין: תפקיד הפריסה לא הוגדר.', 'Анализ недоступен: роль развёртывания не настроена.'],
  'Free web research is not configured. Please try again later.': ['המחקר החינמי ברשת לא הוגדר. יש לנסות שוב מאוחר יותר.', 'Бесплатный поиск в интернете не настроен. Повторите попытку позже.'],
  'Reasoning settings are available for Grok only.': ['הגדרות ההעמקה זמינות רק עבור Grok.', 'Настройки глубины рассуждения доступны только для Grok.'],
  'Reasoning settings are available for Grok only. Select Default for Groq.': ['הגדרות ההעמקה זמינות רק עבור Grok. עבור Groq יש לבחור ברירת מחדל.', 'Настройки глубины рассуждения доступны только для Grok. Для Groq выберите значение по умолчанию.'],
  'Analysis is unavailable: configure ANALYSIS_PROVIDER as groq or xai.': ['הניתוח אינו זמין: יש להגדיר ANALYSIS_PROVIDER לערך groq או xai.', 'Анализ недоступен: задайте ANALYSIS_PROVIDER равным groq или xai.'],
  'Analysis is temporarily unavailable. Please try again later.': ['הניתוח אינו זמין כרגע. יש לנסות שוב מאוחר יותר.', 'Анализ временно недоступен. Повторите попытку позже.'],
  'This deployment is not safely configured.': ['הפריסה הזו אינה מוגדרת באופן בטוח.', 'Это развёртывание настроено небезопасно.'],
  'No independently cited evidence was available for this claim.': ['לא היו ראיות ממקורות מצוטטים בלתי תלויים לטענה זו.', 'Для этого утверждения не найдено доказательств из независимо цитируемых источников.'],
  'The primary research model was unavailable, so a free fallback model was used.': ['מודל המחקר הראשי לא היה זמין, ולכן נעשה שימוש במודל חלופי חינמי.', 'Основная модель поиска была недоступна, поэтому использована бесплатная резервная модель.'],
  'Grok reached its usage limit, so a free research model was used.': ['Grok הגיע למגבלת השימוש, ולכן נעשה שימוש במודל מחקר חינמי.', 'Grok достиг лимита использования, поэтому использована бесплатная модель поиска.'],
  'The research service did not provide verifiable source links; factual claims remain unverified.': ['שירות המחקר לא סיפק קישורים למקורות שניתן לאמת; הטענות העובדתיות נותרו בלתי מאומתות.', 'Сервис поиска не предоставил проверяемых ссылок на источники; фактические утверждения остаются непроверенными.'],
};

export function localize(message, language) {
  if (language !== 'he' && language !== 'ru') return message;
  const delay = message.match(/^Groq's usage limit was reached\. Please try again in (\d+) seconds\.$/);
  if (delay) return language === 'he'
    ? `הגעת למגבלת השימוש של Groq. יש לנסות שוב בעוד ${delay[1]} שניות.`
    : `Достигнут лимит Groq. Повторите попытку через ${delay[1]} сек.`;
  const entry = messages[message];
  return entry?.[language === 'he' ? 0 : 1] ?? message;
}

export function requestLanguage(req) {
  if (languages.includes(req.body?.language)) return req.body.language;
  const header = req.headers?.['accept-language'];
  const first = typeof header === 'string' ? header.split(',')[0].split(';')[0].trim().toLowerCase().split('-')[0] : undefined;
  return languages.includes(first) ? first : undefined;
}

export function outputLanguageInstruction(language) {
  if (!languages.includes(language)) return '';
  const name = { en: 'English', he: 'Hebrew', ru: 'Russian' }[language];
  return ` Write all claim summaries, explanations, category labels, and limitations in ${name}, regardless of the source text language. Keep every excerpt exactly as written in the original text; never translate excerpts. Keep source URLs unchanged and preserve source titles in their original language. Keep status, categoryId, and isReasoningFlaw values exactly as specified by the schema.`;
}
