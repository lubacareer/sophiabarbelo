# Pleroma 3D validation

Validated locally on 2026-11-01. No live analysis providers, credentials, database
resources, deployment settings, or billing were changed for this feature.

## Automated checks

- Full Node test suite: 121 passing tests, including 26 new catalog, geometry,
  localization, and URL-state checks.
- Production Vite build and `git diff --check` pass.
- Catalog: 57 canonical entities (32 John, 11 Ezekiel, 10 Tree, 4 Plotinus),
  seven independent Cicero planet markers, 38 source records. Tests cover
  references, exact excerpts within context, locale coverage, unique IDs, valid
  edges, deterministic layouts, curved connectors, and overlay identities.
- Twelve sourced Gnostic aeons produce twenty-four paired aspect markers.
  They remain twelve source identities, including Sophia once.

## Browser checks

- All four traditions rendered in SVG and WebGL. Tradition changes retain the
  chosen mode and do not spuriously trigger context-loss fallback.
- Paired markers select their parent aeon. The planetary overlay opens Cicero,
  independently of the seven heavens. The torus control is explicitly modern.
- Source expansion, multiple references, Source/Interpretation tabs, keyboard
  node selection, Home/End tab navigation, Escape, and focus restoration work.
- Zoom, Fit, layer navigation, accessible List view, deep links, reload, and
  browser Back/Forward were exercised. Unrelated query parameters and analyzer
  anchors survive navigation.
- English, Hebrew, and Russian controls were checked. Hebrew changes text
  direction without reflecting SVG coordinates. Source quotations retain
  their credited language and Aramaic reading direction.
- At 390px and 320px there is no horizontal page overflow; the source inspector
  follows the canvas in normal scrolling flow. Layer controls remain available
  in a compact horizontally scrollable row. Tree labels wrap into name/gloss.
- Reduced-motion emulation removes SVG bursts/sparks and transition animation.
  Both simulated WebGL initialization failure and context loss fall back to
  interactive SVG with the selected source still accessible.
- A local mock analysis retained its input and result after entering/leaving
  the explorer. Its `/api/analyze` counter remained at the single deliberate
  fixture request throughout explorer interactions. No model credits were used.
- Network observation on the initial analyzer showed no Explorer, catalog,
  Three.js, or Fiber requests. Three/Fiber load only after choosing 3D.
- The production bundle was served with the exact existing Vercel CSP/security
  headers. Both renderers and source controls work without changing the CSP.

## Visual comparison and approved UI revision

The accepted desktop and mobile concepts informed the visualization. The later
approved restyle uses the main-branch analyzer's mint/Nunito UI while retaining
the canvas and scene treatment. The refreshed screenshots are in `docs/images`.

| Reference detail | Implementation and correction |
| --- | --- |
| Mint UI and Nunito, matching the analyzer | Mint page, toolbar, menus, inspector, and canvas controls; green selection states; rounded surfaces; Nunito headings and quotations. |
| Deep green, gold, and sage scene | Canvas explicitly retains #081713; existing geometry, glints, filaments, lighting, cloud texture, and effects are preserved. |
| Luminous curved connections | Cubic Bézier filaments in SVG and Three.js, including every Tree connector. No straight node spokes. |
| Open cosmology canvas | Interactive geometry supplies nodes, rings, labels, and source selection; only the separate cloud is raster imagery. |
| Readable source inspector | Opaque mint panel, comfortable Nunito quotation, edition, reference, translator, reuse link, expandable context, external source link. |
| Mobile flow | Two-by-two tradition choices, large touch controls, and a source panel below the map; fixed clipped outer labels and wrapped Tree glosses. |
| Motion | One finite selection/change burst and traveling sparks; static resting illumination, no automatic rotation, reduced-motion support. |

Intentional differences: the default selection is Barbelo with overlays off;
the mobile screenshot demonstrates the optional paired view. Source data follow
the approved witnesses rather than decorative labels in the concept. Mint UI
and Nunito supersede the original concept's dark/gold controls and serif type.
Full provenance, restoration notices, the layer row, overlay options, and accessible
List view require more vertical space than the concept's abbreviated mobile
reading panel. Tradition changes fade scenes instead of equating their figures.

### Mint/Nunito restyle verification

- Compared the rendered analyzer and `origin/main`'s palette/type rules with
  the explorer at desktop, 390px, and 320px. Updated desktop/mobile screenshots
  show green selections, rounded mint controls, and the Nunito reading panel.
- Both renderer components, geometry, source catalog, and dependencies are
  byte-identical to the pre-restyle commit. Renderer CSS changes only three
  font-family declarations. Its dimensions, colors, atmosphere, and effects
  remain unchanged; the canvas background computes to `rgb(8, 23, 19)`.
- Browser checks exercised all four scenes in both modes, overlays, source
  expansion, List selection, keyboard tabs/focus, zoom/Fit, and retained analyzer
  input. Hebrew retained SVG coordinates; Russian and Aramaic source text were
  checked at narrow widths. Hebrew visual checks used viewport captures.
- No page overflow or framework error overlay was observed. Browser console
  checks found only the existing Three.js Clock deprecation warning.
- UI text contrast: dark ink on mint 15.9:1, secondary text 7.23:1, and white
  on selected green 6.22:1. Page focus uses green; canvas controls and diagram
  labels retain bright focus indicators against the dark background.
- The full 121-test suite, production build, and whitespace checks passed again.

## Practical limits

The 3D chunk is approximately 955 kB minified (253 kB gzip), loaded on demand.
Vite reports its standard large-chunk warning. Current Fiber emits Three.js's
`Clock` deprecation warning; normal production checks produced no application
errors or CSP violations. Failure tests intentionally produce graphics errors.
This is local browser verification, not a physical-device GPU compatibility
matrix. Every source passage is bundled, so changes to source editions require
a curated catalog update.
