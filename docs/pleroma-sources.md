# Pleroma source provenance

Curated on **2026-11-01**. Source passages are bundled locally in the lazy-loaded catalog. Browsing the explorer makes no publisher requests and no model calls. English, Hebrew, and Russian labels, summaries, and comparative notes are original editorial descriptions, kept separate from historical quotations.

## Secret Book of John

- **Witness:** NHC II,1, long recension, consistently selected from Samuel Zinner's translation, edited by Mark Mattison, commissioned by Other Gospels. Each aligned chapter is selected only when its `classes` field equals or contains `codex-ii`.
- [Translation payload](https://othergospels.com/john/zinner.json), [reader](https://othergospels.com/john/), [publisher's reuse statement](https://othergospels.com/about/). SHA-256 of the raw JSON snapshot: `792cedacf98abff3a3c5c07a895554766139111aca8447db6fc3ae22b800bed0`.
- The publisher dedicates its commissioned Zinner/Mattison translation to the public domain. The same reader also contains a **Davies translation with reserved electronic reproduction rights**. No Davies text, publisher commentary, introductions, other manuscript columns, or proprietary reader code was copied.
- References use Other Gospels' **editorial** chapter/verse numbering, not ancient verse numbers. Restoration brackets and translated wording are preserved. Markdown verse numbers, manuscript folio markers, and repeated whitespace are presentation-normalized.
- Twelve associated aeons occur in four groups of three in §7:8–15. Sophia is already one of those twelve. Faculty labels match this translation: **Precognition** and **Indestructibility**. The displayed ruler name **Yaltabaoth** also follows this edition; stable internal IDs need not reproduce transliteration spelling.
- The optional twenty-four aspect markers visualize the twelve parent aeons twice as a **modern masculine/feminine metaphor**. They do not invent twelve named counterparts or claim twenty-four named aeons in this witness. Each facet resolves to its parent entity and citations.
- Sophia's shining cloud is explicit in §9:8. No separately source-attributed "veil" is invented. Seven heavens and corresponding kings in §11:1 are not silently equated with particular planets.

## Ezekiel

- **World English Bible Classic:** [chapter 1](https://ebible.org/eng-web/EZK01.htm), [chapter 10](https://ebible.org/eng-web/EZK10.htm), [public-domain declaration](https://ebible.org/publicdomain.htm).
- Quotations remove verse-marker markup, footnote popups, and repeated whitespace. The four living creatures, four wheel assemblies, eye-covered rims, expanse, throne, and coordinated movement have separate source references.
- No exact eye count is inferred. The optional torus is a modern geometric illustration of wheel-within-wheel imagery, not a mathematical specification attributed to Ezekiel.

## Ten Sefirot

- Named figures and bodily metaphors: **Tikkunei Zohar 17a:16–18**, explicitly selected version **Tikkunei Zohar - Vocalized**. The API's `heLicense` was `Public Domain`, and `heVersionTitle` matched that exact edition. Only its Aramaic `he` field was used. The default English version by David Solomon (2024), marked `CC-BY-NC`, was **not** copied.
- [Version-specific API](https://www.sefaria.org/api/texts/Tikkunei_Zohar.17a?lang=he&vhe=Tikkunei%20Zohar%20-%20Vocalized&context=0). Chokhmah's phrase spans digital segments 16–17. Short excerpts retain the selected edition's exact spelling/vocalization; full context includes segments 16–18.
- Ten-count: **Sefer Yetzirah 1:4**, exact English version **Sefer Yezirah, trans. by Isidor Kalisch. New York, 1877**. Its API `license` was `Public Domain` and `versionTitle` matched that version. [Version-specific API](https://www.sefaria.org/api/texts/Sefer_Yetzirah.1.4?lang=en&ven=Sefer%20Yezirah%2C%20trans.%20by%20Isidor%20Kalisch.%20New%20York%2C%201877&context=0).
- English, Hebrew, and Russian explanatory glosses are editorial, not translated historical quotations. The exact Aramaic source remains visibly distinct from them.
- The visualization is a **later three-column Jewish teaching schematic**, with Keter included and no additional Da'at node. The thirteen curved connectors are editorial layout aids, not a claim that these precise paths occur in either cited passage. There are no Tarot, Hebrew-letter, planetary, or "twenty-two paths" assignments. UI language changes do not mirror the selected diagram convention.

## Plotinus

- Use **Stephen MacKenna's original historical translations**, not an unverified later revision. Primary quotations and context were checked against the proofread transcriptions of the original page images:
  - **1926 Fifth Ennead**, printed page 2 / [digital page 15](https://en.wikisource.org/wiki/Page:Plotinus_-_The_Enneads_Vol._4_-_tr._Stephen_MacKenna_(1926).djvu/15): V.1.2, Soul and living things.
  - Printed page 9 / [digital page 22](https://en.wikisource.org/wiki/Page:Plotinus_-_The_Enneads_Vol._4_-_tr._Stephen_MacKenna_(1926).djvu/22): V.1.6–7, relation of One, Intellect, and Soul.
  - Printed pages 13–14 / [digital page 26](https://en.wikisource.org/wiki/Page:Plotinus_-_The_Enneads_Vol._4_-_tr._Stephen_MacKenna_(1926).djvu/26) and the following page: V.1.10, the order of the three principles.
  - **1924 Fourth Ennead**, printed page 28 / [digital page 41](https://en.wikisource.org/wiki/Page:Plotinus_-_The_Enneads_Vol._3_-_tr._Stephen_MacKenna_(1924).djvu/41): IV.3.17, circles of light.
- The earlier research used the MIT reading pages, whose attribution also names B. S. Page. To avoid silently assuming that every later revision has the same rights, the bundled records were replaced with quotations and surrounding context from the documented **1924/1926 MacKenna editions** above. Original punctuation is retained, with whitespace normalized. Modern proofreader notices, page furniture, and wiki styling were not copied.
- Ring positions are a visual analogy for metaphysical dependence, not physical distances, an astronomical system, or generation in time. The sensible cosmos is not presented as a fourth principle of the same rank as the three initial hypostases.

## Classical planetary comparison

- **Cicero, On the Republic VI.17 (Dream of Scipio), C. W. Keyes translation (1928):** [primary passage](https://www.attalus.org/cicero/republic6.html). The publication date and translator are identified on that page. The historical translation is public domain; no modern editorial commentary was copied.
- HTML was decoded according to its declared character encoding, avoiding replacement characters in punctuation. Whitespace and footnote-link presentation are normalized.
- Cicero lists the moving spheres outside-to-inside as Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon. The comparison reverses this into **inside-to-outside** order. Its seven independently selectable planet markers cite Cicero; they are not members of the John graph and have no identity edges to Gnostic rulers or heavens.
- This is a historical geocentric comparison, not modern astronomy. The seven moving spheres do not exhaust Cicero's complete nine-sphere account, which also includes the fixed stars and Earth.

## Graph and source boundaries

`textual` graph edges indicate a relationship or association in a cited passage. They do not all mean the same kind of relation or imply physical emanation. `schematic` edges are editorial geometry. Modern overlays and comparative notes do not claim universal identity or historical derivation between traditions. Exact source text is never silently replaced by a generated translation.

## Visual asset

`src/pleroma/assets/sophia-cloud.png` is an independently generated transparent
cloud texture created for this feature with OpenAI image generation. It contains
no text or diagram nodes and is not a historical source. Nodes, labels, rings,
filaments, stars, and controls are rendered in code.
