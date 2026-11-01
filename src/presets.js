// Demonstration inputs, not expected verdicts. Source metadata is displayed in the
// UI; only the selected text is submitted through the normal analysis flow.
// Bible excerpts preserve their editions' wording, with whitespace normalized.
export const presets = [
  {
    id: 'job-friends',
    group: 'ancient',
    reference: 'Job 4:7–9; 8:3–6; 11:5–6',
    kind: 'excerpt',
    sources: [
      { title: 'World English Bible Classic · Public domain', url: 'https://ebible.org/eng-web/' },
      { title: 'Westminster Leningrad Codex · Public domain text', url: 'https://ebible.org/hebwlc/' },
      { title: 'Синодальный перевод · Public domain', url: 'https://ebible.org/russyn/' },
    ],
    locales: {
      en: {
        title: 'Job’s three friends',
        description: 'Three separate responses about suffering, innocence, and justice.',
        attribution: 'Selected public-domain excerpts: World English Bible Classic. Speaker labels and references added; these are separate passages.',
        text: 'Eliphaz — Job 4:7–9\n“Remember, now, who ever perished, being innocent? Or where were the upright cut off? According to what I have seen, those who plow iniquity and sow trouble, reap the same. By the breath of God they perish. By the blast of his anger are they consumed.\n\nBildad — Job 8:3–6\nDoes God pervert justice? Or does the Almighty pervert righteousness? If your children have sinned against him, he has delivered them into the hand of their disobedience. If you want to seek God diligently, make your supplication to the Almighty. If you were pure and upright, surely now he would awaken for you, and make the habitation of your righteousness prosperous.\n\nZophar — Job 11:5–6\nBut oh that God would speak, and open his lips against you, that he would show you the secrets of wisdom! For true wisdom has two sides. Know therefore that God exacts of you less than your iniquity deserves.',
      },
      he: {
        title: 'שלושת רעיו של איוב',
        description: 'שלוש תשובות נפרדות על סבל, חפות וצדק.',
        attribution: 'קטעים נבחרים מטקסט WLC שברשות הציבור. נוספו שמות הדוברים ומראי מקום; אלה קטעים נפרדים.',
        text: 'אליפז — איוב 4:7–9\nזְכָר־נָ֗א מִ֤י ה֣וּא נָקִ֣י אָבָ֑ד וְ֝אֵיפֹ֗ה יְשָׁרִ֥ים נִכְחָֽדוּ׃ כַּאֲשֶׁ֣ר רָ֭אִיתִי חֹ֣רְשֵׁי אָ֑וֶן וְזֹרְעֵ֖י עָמָ֣ל יִקְצְרֻֽהוּ׃ מִנִּשְׁמַ֣ת אֱל֣וֹהַ יֹאבֵ֑דוּ וּמֵר֖וּחַ אַפּ֣וֹ יִכְלֽוּ׃\n\nבלדד — איוב 8:3–6\nהַ֭אֵל יְעַוֵּ֣ת מִשְׁפָּ֑ט וְאִם־שַׁ֝דַּ֗י יְעַוֵּֽת־צֶֽדֶק׃ אִם־בָּנֶ֥יךָ חָֽטְאוּ־ל֑וֹ וַֽ֝יְשַׁלְּחֵ֗ם בְּיַד־פִּשְׁעָֽם׃ אִם־אַ֭תָּה תְּשַׁחֵ֣ר אֶל־אֵ֑ל וְאֶל־שַׁ֝דַּ֗י תִּתְחַנָּֽן׃ אִם־זַ֥ךְ וְיָשָׁ֗ר אָ֥תָּה כִּי־עַ֭תָּה יָעִ֣יר עָלֶ֑יךָ וְ֝שִׁלַּ֗ם נְוַ֣ת צִדְקֶֽךָ׃\n\nצופר — איוב 11:5–6\nוְֽאוּלָ֗ם מִֽי־יִתֵּ֣ן אֱל֣וֹהַּ דַּבֵּ֑ר וְיִפְתַּ֖ח שְׂפָתָ֣יו עִמָּֽךְ׃ וְיַגֶּד־לְךָ֨ ׀ תַּֽעֲלֻמ֣וֹת חָכְמָה֮ כִּֽי־כִפְלַ֪יִם לְֽת֫וּשִׁיָּ֥ה וְדַ֡ע כִּֽי־יַשֶּׁ֥ה לְךָ֥ אֱ֝ל֗וֹהַ מֵעֲוֺנֶֽךָ׃',
      },
      ru: {
        title: 'Три друга Иова',
        description: 'Три отдельных ответа о страдании, невиновности и справедливости.',
        attribution: 'Избранные отрывки Синодального перевода, общественное достояние. Добавлены имена говорящих и ссылки; это отдельные места текста.',
        text: 'Елифаз — Иов 4:7–9\nВспомни же, погибал ли кто невинный, и где праведные бывали искореняемы? Как я видал, то оравшие нечестие и сеявшие зло пожинают его; от дуновения Божия погибают и от духа гнева Его исчезают.\n\nВилдад — Иов 8:3–6\nНеужели Бог извращает суд, и Вседержитель превращает правду? Если сыновья твои согрешили пред Ним, то Он и предал их в руку беззакония их. Если же ты взыщешь Бога и помолишься Вседержителю, и если ты чист и прав, то Он ныне же встанет над тобою и умиротворит жилище правды твоей.\n\nСофар — Иов 11:5–6\nНо если бы Бог возглаголал и отверз уста Свои к тебе и открыл тебе тайны премудрости, что тебе вдвое больше следовало бы понести! Итак знай, что Бог для тебя некоторые из беззаконий твоих предал забвению.',
      },
    },
  },
  {
    id: 'job-whirlwind',
    group: 'ancient',
    reference: 'Job 38:1–11',
    kind: 'excerpt',
    sources: [
      { title: 'World English Bible Classic · Job 38', url: 'https://ebible.org/eng-web/JOB38.htm' },
      { title: 'Westminster Leningrad Codex · Job 38', url: 'https://ebible.org/hebwlc/JOB38.htm' },
      { title: 'Синодальный перевод · Иов 38', url: 'https://ebible.org/russyn/JOB38.htm' },
    ],
    locales: {
      en: {
        title: 'Job: the voice from the whirlwind',
        description: 'Questions, imagery, and authority in the opening of Job 38.',
        attribution: 'Public-domain excerpt: World English Bible Classic, Job 38:1–11.',
        text: 'Then Yahweh answered Job out of the whirlwind, “Who is this who darkens counsel by words without knowledge? Brace yourself like a man, for I will question you, then you answer me! “Where were you when I laid the foundations of the earth? Declare, if you have understanding. Who determined its measures, if you know? Or who stretched the line on it? What were its foundations fastened on? Or who laid its cornerstone, when the morning stars sang together, and all the sons of God shouted for joy? “Or who shut up the sea with doors, when it broke out of the womb, when I made clouds its garment, and wrapped it in thick darkness, marked out for it my bound, set bars and doors, and said, ‘You may come here, but no further. Your proud waves shall be stopped here’?',
      },
      he: {
        title: 'איוב: הקול מן הסערה',
        description: 'שאלות, דימויים וסמכות בפתיחת פרק ל״ח באיוב.',
        attribution: 'קטע מטקסט WLC שברשות הציבור, איוב 38:1–11.',
        text: 'וַיַּֽעַן־יְהוָ֣ה אֶת־אִ֭יּוֹב מנ הסערה וַיֹּאמַֽר׃ מִ֤י זֶ֨ה ׀ מַחְשִׁ֖יךְ עֵצָ֥ה בְמִלִּ֗ין בְּֽלִי־דָֽעַת׃ אֱזָר־נָ֣א כְגֶ֣בֶר חֲלָצֶ֑יךָ וְ֝אֶשְׁאָלְךָ֗ וְהוֹדִיעֵֽנִי׃ אֵיפֹ֣ה הָ֭יִיתָ בְּיָסְדִי־אָ֑רֶץ הַ֝גֵּ֗ד אִם־יָדַ֥עְתָּ בִינָֽה׃ מִי־שָׂ֣ם מְ֭מַדֶּיהָ כִּ֣י תֵדָ֑ע א֤וֹ מִֽי־נָטָ֖ה עָלֶ֣יהָ קָּֽו׃ עַל־מָ֭ה אֲדָנֶ֣יהָ הָטְבָּ֑עוּ א֥וֹ מִֽי־יָ֝רָ֗ה אֶ֣בֶן פִּנָּתָֽהּ׃ בְּרָן־יַ֭חַד כּ֣וֹכְבֵי בֹ֑קֶר וַ֝יָּרִ֗יעוּ כָּל־בְּנֵ֥י אֱלֹהִֽים׃ וַיָּ֣סֶךְ בִּדְלָתַ֣יִם יָ֑ם בְּ֝גִיח֗וֹ מֵרֶ֥חֶם יֵצֵֽא׃ בְּשׂוּמִ֣י עָנָ֣ן לְבֻשׁ֑וֹ וַ֝עֲרָפֶ֗ל חֲתֻלָּתֽוֹ׃ וָאֶשְׁבֹּ֣ר עָלָ֣יו חֻקִּ֑י וָֽ֝אָשִׂ֗ים בְּרִ֣יחַ וּדְלָתָֽיִם׃ וָאֹמַ֗ר עַד־פֹּ֣ה תָ֭בוֹא וְלֹ֣א תֹסִ֑יף וּפֹ֥א־יָ֝שִׁ֗ית בִּגְא֥וֹן גַּלֶּֽיךָ׃',
      },
      ru: {
        title: 'Иов: голос из бури',
        description: 'Вопросы, образы и авторитет в начале главы 38 книги Иова.',
        attribution: 'Отрывок Синодального перевода, общественное достояние: Иов 38:1–11.',
        text: 'Когда Елиуй перестал говорить, Господь отвечал Иову из бури и сказал: кто сей, омрачающий Провидение словами без смысла? Препояшь ныне чресла твои, как муж: Я буду спрашивать тебя, и ты объясняй Мне: где был ты, когда Я полагал основания земли? Скажи, если знаешь. Кто положил меру ей, если знаешь? или кто протягивал по ней вервь? На чем утверждены основания ее, или кто положил краеугольный камень ее, при общем ликовании утренних звезд, когда все сыны Божии восклицали от радости? Кто затворил море воротами, когда оно исторглось, вышло как бы из чрева, когда Я облака сделал одеждою его и мглу пеленами его, и утвердил ему Мое определение, и поставил запоры и ворота, и сказал: доселе дойдешь и не перейдешь, и здесь предел надменным волнам твоим?',
      },
    },
  },
  {
    id: 'panarion',
    group: 'ancient',
    reference: 'Epiphanius, Panarion 70.9.2–6',
    kind: 'adaptation',
    sources: [
      { title: 'Epiphanius · Panarion 70, chapter 9 · source passage', url: 'https://www.tertullian.org/rpearse/epiphanius.html' },
    ],
    locales: {
      en: {
        title: 'Panarion: a disputed festival calendar',
        description: 'A short adaptation of an argument over tradition and unity.',
        attribution: 'Original demonstration adaptation of Panarion 70.9.2–6, not a quotation or a translation of the complete passage.',
        text: 'The Audians keep Passover alongside the Jews. They say our churches altered the inherited practice to flatter Constantine. I reject their accusation: his purpose was agreement among churches, not a birthday celebration. God used this beloved emperor to assemble the bishops, reject Arius, and settle our common observance.',
      },
      he: {
        title: 'פנריון: מחלוקת על מועד החג',
        description: 'עיבוד קצר של טיעון על מסורת ואחדות.',
        attribution: 'עיבוד מקורי להדגמה על פי פנריון 70.9.2–6, לא ציטוט ולא תרגום של הקטע המלא.',
        text: 'האודיאנים מציינים את הפסח לצד היהודים. הם טוענים שכנסיותינו שינו את המסורת כדי להחניף לקונסטנטינוס. אני דוחה את האשמתם: מטרתו הייתה הסכמה בין הכנסיות, ולא חגיגת יום הולדת. האל פעל באמצעות הקיסר האהוב הזה לכינוס הבישופים, לדחיית אריוס ולקביעת מועד משותף לחג.',
      },
      ru: {
        title: '«Панарион»: спор о дате праздника',
        description: 'Краткая адаптация рассуждения о традиции и единстве.',
        attribution: 'Оригинальная демонстрационная адаптация «Панариона» 70.9.2–6, а не цитата или перевод полного отрывка.',
        text: 'Аудиане празднуют Пасху вместе с иудеями. Они говорят, что наши церкви изменили унаследованный обычай, чтобы угодить Константину. Я отвергаю это обвинение: он стремился к согласию церквей, а не к празднованию дня рождения. Через этого возлюбленного императора Бог собрал епископов, отверг Ария и установил общий порядок празднования.',
      },
    },
  },
  {
    id: 'viral-hospital-photos',
    group: 'media',
    reference: 'Walla · 2026-10-22',
    kind: 'adaptation',
    sources: [
      { title: 'Walla · Kim Jong Un images and rumors · 22 October 2026', url: 'https://www.walla.co.il/news/donotmiss/383958416' },
    ],
    locales: {
      en: {
        title: 'Viral hospital images',
        description: 'A dated media example about rumors and verification.',
        attribution: 'Original demonstration adaptation of Walla’s report dated 22 October 2026, not an article quotation. It describes that report’s findings at that time.',
        text: 'Is Kim Jong Un dead? Images spread as proof. Walla reported on 22 October 2026 that AI checks suggested synthetic hospital photos, without conclusive forensic proof. A circulated video concerned his father’s death in 2011. The claims about Kim’s death remained unsubstantiated.',
      },
      he: {
        title: 'תמונות אשפוז ויראליות',
        description: 'דוגמה תקשורתית מתוארכת על שמועות ואימות.',
        attribution: 'עיבוד מקורי להדגמה של דיווח וואלה מ־22 באוקטובר 2026, לא ציטוט מהכתבה. הוא מתאר את ממצאי הדיווח באותו מועד.',
        text: 'קים ג׳ונג און מת? תמונות הופצו כהוכחה. וואלה דיווחה ב־22 באוקטובר 2026 שבדיקות בינה מלאכותית הצביעו על תמונות אשפוז מלאכותיות, ללא הוכחה פורנזית מכרעת. סרטון שהופץ עסק במות אביו ב־2011. הטענות על מותו של קים נותרו ללא ביסוס.',
      },
      ru: {
        title: 'Вирусные снимки из больницы',
        description: 'Датированный пример из СМИ о слухах и проверке.',
        attribution: 'Оригинальная демонстрационная адаптация сообщения Walla от 22 октября 2026 года, а не цитата из статьи. Описаны выводы публикации на ту дату.',
        text: 'Ким Чен Ын умер? Снимки распространялись как доказательство. Walla сообщила 22 октября 2026 года, что ИИ-проверки указали на искусственное происхождение больничных снимков, но не дали окончательного экспертного доказательства. Распространённое видео касалось смерти его отца в 2011 году. Утверждения о смерти Кима оставались неподтверждёнными.',
      },
    },
  },
];
