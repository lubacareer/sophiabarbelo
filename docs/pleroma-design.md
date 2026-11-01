# Pleroma 3D design and interaction specification

Approved visual references:

- Desktop: exec-06db24fe-dd65-4df6-b7f0-80c45ec4b344.png
- Mobile: exec-3e43c6de-86bf-4679-b632-6d1e6dce148c.png

The reference files are in the Codex generated_images folder for this chat.
They define visual treatment, not authoritative source text or entity topology.
Source records and deterministic layouts supply the actual interactive diagrams.

## Visual system

Deep evergreen canvas #081713; raised surfaces #10271e; antique gold #d5be80;
sage labels #c2d8c6; pale sage reading panel #eaf2e4 with ink #10271e.
Use local Nunito for controls and Georgia/system serif for headings and quotations.
The canvas is open space with curved luminous connections, a radiant center,
finite selection bursts, restrained static stars and a separately generated cloud.
The reading inspector remains calm and opaque. No card grids or marketing sections.

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

Compare approved concepts with desktop and mobile renders before handoff:
layout, typography, palette, curved geometry/light treatment, inspector/source
readability, control spacing, responsive flow and RTL. Document concrete fixes
and intentional source-data differences in the PR validation notes.
