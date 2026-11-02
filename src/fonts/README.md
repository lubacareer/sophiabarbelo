# Local interface fonts

Nunito remains the Latin interface font. The Hebrew and Cyrillic webfonts below
are derived from the user-supplied font files in `assets/fonts`; the originals and
download archives are unchanged. No fonts are requested from a third-party CDN.

| Family | Subset | Weights | WOFF2 size |
| --- | --- | --- | --- |
| Fredoka | Hebrew letters, supported niqqud and presentation forms | Variable 300–700 | 7,952 bytes |
| M PLUS Rounded 1c | Cyrillic and supported combining accents | 400 | 17,464 bytes |
| M PLUS Rounded 1c | Cyrillic and supported combining accents | 500 | 17,324 bytes |
| M PLUS Rounded 1c | Cyrillic and supported combining accents | 700 | 17,364 bytes |
| M PLUS Rounded 1c | Cyrillic and supported combining accents | 800 | 17,480 bytes |

The script-specific faces contain no Latin letters. CSS `unicode-range` chooses
them by character, including Hebrew or Russian passages within another interface
language. Keep the system-font fallback: the supplied Fredoka has no cantillation
marks, meteg, paseq, or sof pasuq. Source quotations retain those characters and
may use the fallback for unsupported characters or shaping clusters. Fredoka
does include the regular Hebrew letters and vowel points. The Cyrillic subset
covers every Russian letter used by the application, including Ё/ё.

## License and attribution

- Fredoka: Copyright 2016 The Fredoka Project Authors
  (<https://github.com/hafontia/Fredoka-One>).
- M PLUS Rounded 1c: Copyright 2016 The Rounded M+ Project Authors.

Both supplied families use SIL Open Font License 1.1, with no reserved font name
declared. Their licenses are copied into the corresponding family directories.
The derived webfonts preserve their original copyright and license metadata.
The existing Nunito license remains in `OFL.txt`.

## Derivation

Generated with fontTools 4.63.0 and its already-installed Brotli backend. This is
an authoring step, not an application dependency. `subset-provenance.json` records
each original file's SHA-256, output size, exact Unicode coverage and axes.

1. Load each original TTF using `fontTools.ttLib.TTFont`.
2. Subset with `fontTools.subset.Subsetter`: keep all OpenType layout features,
   name IDs and languages, legacy names, and the `.notdef` glyph and outline.
3. For Fredoka, request `U+0590–05FF` and `U+FB1D–FB4F`, then use
   `fontTools.varLib.instancer.instantiateVariableFont` to fix `wdth` to its normal
   value of 100. Preserve the `wght` axis from 300 to 700.
4. For each M PLUS Rounded weight, request `U+0300–036F`, `U+0400–052F`,
   `U+1C80–1C8F`, `U+2DE0–2DFF`, and `U+A640–A69F`. The supplied font has no glyphs
   in the latter three blocks, so these do not expand the output coverage.
5. Set `font.flavor = 'woff2'` and save to the family directory. Reload each file
   and verify its Unicode map matches the intersection of the original font and
   requested ranges.

OpenType layout tables are retained for vowel positioning and combining marks;
subsetting does not edit quotation text or invent missing glyphs.
