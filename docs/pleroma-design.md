# Pleroma 3D design and interaction specification

Current implementation references:

- [Desktop screenshot](images/pleroma-desktop.png)
- [Mobile screenshot](images/pleroma-mobile.png)

These repository screenshots capture the bright grass-green revision with
translucent mint surfaces and rounded typography. Desktop shows the Tree in 3D with the
Hermetic overlays; mobile shows the same correspondences in Hebrew and 2D.
The screenshots document the visualization treatment; source records
and deterministic layouts supply the diagrams and their source-based topology.

## Visual system

UI surfaces use the analyzer's generated book-of-wisdom background and translucent
bright grass-tinted mint panels, borders #9cce84, headings #173d30, body #254638,
lime selected controls #7bec52, and structural green #286d32. Rounded controls, menus, and reading
surfaces follow the analyzer's visual language. Use local Fredoka for Hebrew,
M PLUS Rounded 1c for Russian/Cyrillic, and Nunito for Latin text, including
headings, source quotations, controls, personal notes, and diagram labels.
Script-specific webfonts also apply to mixed-language passages, independently
of the interface language. Keep sans-serif fallbacks for glyphs outside the
supplied fonts, including rare biblical cantillation marks. Font licenses and
derivation details are in [the font notes](../src/fonts/README.md).
The reading inspector uses mint
glass and an 18px backdrop blur, matching the analyzer's rhetoric panels.

The visualization retains its explicit deep evergreen #081713 canvas, existing
gold illumination, sage labels, curved luminous connections, radiant centers,
finite selection bursts, static stars, and separately generated cloud. Styling
the surrounding page must not tint the transparent WebGL canvas. Diagram-label
changes are limited to font family; their sizes, colors, anchors, and shadows
remain unchanged. The My connections editor uses compact forms and a local collection list.

Desktop: quiet 56px brand/navigation header, title and one tradition toolbar,
large canvas and a roughly 360–410px reading inspector. The inspector can close.
Mobile: two-by-two tradition choices, 2D initially, 44px touch controls,
canvas followed by the reading inspector in normal document flow.
RTL changes text and chrome, never the chosen diagram's geometric orientation.

## Copy and component inventory

Header: Sophia’s Mirror; Analyze; Pleroma 3D; language selector.
Title: Pleroma 3D; Explore four traditions of the cosmos.
Traditions: Secret Book of John; Ezekiel’s wheels; Tree of Life; Plotinus.
Controls: 2D / 3D; Explore correspondences; My connections; Tarot; Astrology; Paired aspects; Classical planetary
comparison; Toroidal visualization; Center / Pleroma / Sophia’s cloud /
Seven heavens where applicable; zoom in / out; Fit; List view.
Inspector: selected entity, category, Source / Interpretation, exact passage,
edition/reference, translator and rights, Read full passage / collapse,
Open source, close control. Textual restorations are preserved.

The explorer provides an expandable overlay-options menu, a keyboard-accessible
entity list, clear WebGL fallback status, and provenance for every source.
These capabilities are required by the approved interaction plan.

## Motion and rendering

All actual node connections are curved in both modes. Tradition transitions
fade unmatched entities, never imply identity between traditions. One brief
gold-white light burst and traveling spark pulse follows selection or switching.
Static glow remains after the animation. Reduced motion disables bursts,
travel and transition animation. No autorotation or infinite animation.
Geometry and controls are code-native; the screenshots are never used as UI.

## Review requirements

Compare desktop and mobile renders with the repository screenshots above and
the main-branch analyzer's UI palette and typography. Review layout, typography,
palette, curved geometry/light treatment, inspector/source readability, control
spacing, responsive flow and RTL. Document concrete fixes and intentional
source-data differences in the PR validation notes.
