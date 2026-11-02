# Open-ended symbolic exploration

This extension to PR #7 is available on the same public and administrator
interfaces. The explorer welcomes intuition, Tarot, astrology, and other symbolic
readings while keeping credited passages easy to return to in Source.

## Explorer

The Tree has independently selectable Tarot and Astrology facets of **Hermetic
correspondences — 777 (1909)**. Either facet replaces the base thirteen layout
connectors with the same twenty-two curved, selectable paths. Both facets together
share those paths. Astrology adds ten selectable celestial associations beside
the sefirot. Turning both off restores the original Tree. Other source graphs,
their entity IDs, and their existing overlays remain intact.

The correspondence catalog contains 22 path records, ten celestial records,
32 source records, and a palette of 41 Tarot, zodiac, and planetary symbols.
The [source notes](pleroma-sources.md#hermetic-correspondences--777-1909) identify
the original columns and key-scale rows. Paths use numbers 11–32, rather than
assuming a deck's card numbering. Source excerpts retain historical cell wording;
localized names and Ways to explore are contemporary presentation text.

Paths and associations can be selected in SVG, WebGL, and the keyboard-accessible
List view. Existing node hit targets remain above path targets. Selected labels
and the inspector carry detail so the canvas stays readable. New query parameters
retain a validated path selection; personal text never enters navigation URLs.

The page reuses the analyzer's generated background, bright grass-tinted mint glass,
lime accents (#7bec52), Nunito,
forest-green headings and reading text. The canvas keeps its dark evergreen
backdrop and gold illumination. Mobile retains the inspector below the canvas;
RTL does not mirror the map. Reduced motion keeps illumination static.

## Personal connections

My connections creates relationships from any figure to another figure, a Tarot
or astrological symbol, or a custom named destination. Same-map relationships
draw curves; cross-map connections link to their referenced figures. All personal
labels and notes render as plain text.

Collections are private to the browser and site origin under the versioned
`sophia-pleroma-personal-v1` key. No API receives them. A public collection is
independent of an administrator or preview collection; export/import transfers it.
Collections allow up to 100 connections, 80-character names and 2,000-character
notes, within a 256 KiB JSON document. Imports validate all records before merging,
preserve existing entries, ignore identical duplicates, and reject conflicting IDs
without partially applying a file.

Unavailable storage retains explicit edits in memory for the current app session,
including switching between Analyze and Pleroma. The interface explains when an
export is needed. Unreadable saved data is not erased by loading the page. Drafts
survive hiding the personal editor while the explorer remains mounted.

## Symbolic analysis API

`GET /api/config` advertises the additive capability `symbolicReadings: true`.
Older configurations omit it and do not display the new control.

`POST /api/analyze` accepts optional boolean `includeSymbolicReadings`, default
false. Invalid values fail before quota acquisition and URL extraction. When
enabled, the response adds `symbolicReadings`, an array of zero to three records:

```json
{
  "excerpt": "an exact substring of sourceText",
  "title": "A possible reading",
  "reading": "An interpretation grounded in the excerpt",
  "reflectionQuestion": "An open question for the reader",
  "basis": "reflection",
  "tradition": "",
  "sources": []
}
```

`basis: "tradition"` requires a named tradition and at least one surviving
provider-reported source URL. An uncited tradition entry is discarded. Reflection
entries have an empty tradition and source list. Exact excerpts and safe source
URLs are validated; Gemini/GLM use retrieved source titles. The client validates
the new records before rendering and strips unrequested symbolic additions.

The option uses the selected model's existing calls and limits. Luna produces
readings in its researched analysis call, keeping the passage-only rhetorical
call separate. Gemini, GLM, Grok, and local routing use the same opt-in contract.
Research caps, request deadlines, visitor quotas, and provider availability guards
remain unchanged. No additional analysis call or automatic provider fallback is
introduced. Symbolic readings have their own section without factual verdict
badges or factual highlight colors.

The per-origin preference starts off and is disabled during analysis. Changing
it or the model preserves existing results and their language/model attribution.
All controls and generated-output instructions support English, Hebrew, and
Russian. Personal explorer notes are never included automatically.

## Validation

Validation uses local public/admin fixtures and mocked transports, with no live
model calls or credential changes. Results and refreshed screenshots are recorded
in [Pleroma validation](pleroma-validation.md). The existing CI job supplies real
Redis integration checks before this PR is considered ready.

The accompanying review corrections clarify that cancellation stops awaiting
DNS without terminating the underlying lookup, bound the real-Redis test's
analysis-readiness wait against early HTTP failure and a timeout, and classify
actual shared-deadline expiry as `timeout` in safe diagnostics. External
cancellation remains `cancelled`; no input, credential, URL path, or private
cancellation reason is logged. Regressions cover early 503 responses, stalled
readiness, query/analysis fetch and body expiry, and late transport failures.

Pushing PR #7 creates Git-triggered previews for both projects. Production receives
the feature through the normal merge workflow; this work does not merge the PR or
manually redeploy either project.
