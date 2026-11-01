# Pleroma 3D design and interaction specification

Approved visual references:

- Desktop: exec-06db24fe-dd65-4df6-b7f0-80c45ec4b344.png
- Mobile: exec-3e43c6de-86bf-4679-b632-6d1e6dce148c.png

The reference files are in the Codex generated_images folder for this chat.
They define the visualization treatment, not authoritative source text or entity
topology. The subsequent approved UI revision matches the main-branch analyzer:
mint surfaces and Nunito throughout replace the concepts' dark/gold chrome and
serif typography. Source records and deterministic layouts supply the diagrams.

## Visual system

UI surfaces use the analyzer's mint #d8f0df and #e4f6e9, borders #b8d9c4,
ink #061b12, and green accent #246d50. Rounded controls, menus, and reading
surfaces follow the analyzer's visual language. Use local Nunito throughout,
including headings, source quotations, and diagram labels, with sans-serif
fallbacks for glyphs outside the bundled font. The reading inspector is opaque.

The visualization retains its explicit deep evergreen #081713 canvas, existing
gold illumination, sage labels, curved luminous connections, radiant centers,
finite selection bursts, static stars, and separately generated cloud. Styling
the surrounding page must not tint the transparent WebGL canvas. Diagram-label
changes are limited to font family; their sizes, colors, anchors, and shadows
remain unchanged. No card grids or marketing sections are added.

Desktop: quiet 56px brand/navigation header, title and one tradition toolbar,
large canvas and a roughly 360–410px reading inspector. The inspector can close.
Mobile: two-by-two tradition choices, 2D initially, 44px touch controls,
canvas followed by the reading inspector in normal document flow.
RTL changes text and chrome, never the chosen diagram's geometric orientation.

## Copy and component inventory

Header: Sophia’s Mirror; Analyze; Pleroma 3D; language selector.
Title: Pleroma 3D; Explore four traditions of the cosmos.
Traditions: Secret Book of John; Ezekiel’s wheels; Tree of Life; Plotinus.
Controls: 2D / 3D; Interpretive overlays; Paired aspects; Classical planetary
comparison; Toroidal visualization; Center / Pleroma / Sophia’s cloud /
Seven heavens where applicable; zoom in / out; Fit; List view.
Inspector: selected entity, category, Source / Interpretation, exact passage,
edition/reference, translator and rights, Read full passage / collapse,
Open source, close control. Textual restorations are preserved.

Functional additions to the screenshots: an expandable overlay-options menu,
a keyboard-accessible entity list, clear WebGL fallback status, and provenance
for every source. These are required by the approved interaction plan.

## Motion and rendering

All actual node connections are curved in both modes. Tradition transitions
fade unmatched entities, never imply identity between traditions. One brief
gold-white light burst and traveling spark pulse follows selection or switching.
Static glow remains after the animation. Reduced motion disables bursts,
travel and transition animation. No autorotation or infinite animation.
Geometry and controls are code-native; the screenshots are never used as UI.

## Review requirements

Compare the main-branch analyzer's UI palette and typography with desktop and
mobile renders, and compare the visualization with its pre-restyle screenshot:
layout, typography, palette, curved geometry/light treatment, inspector/source
readability, control spacing, responsive flow and RTL. Document concrete fixes
and intentional source-data differences in the PR validation notes.
