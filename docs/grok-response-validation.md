# Grok response handling — 2026-11-02

The public site reported the Hebrew equivalent of "The analysis service returned
an incomplete result" for the Hebrew `job-whirlwind` preset (Job 38:1–11), with
Grok 4.7 and symbolic readings enabled. The browser recorded HTTP 502 from
`/api/analyze`. Extension-script messages, the favicon 404, and the visualizer's
Three.js deprecation warning do not identify the provider failure.

## Evidence and limits

Two bounded live checks on the pre-fix code used that same public-domain preset,
Hebrew output, low effort, and symbolic readings:

| Path | Result | Duration | Validated findings |
| --- | --- | --- | --- |
| Direct Grok adapter | HTTP 200, completed response | 82.0 seconds | 3 claims, 3 rhetoric entries, 3 symbolic readings |
| Public production `/api/analyze` | HTTP 200, Grok attribution, exact source text, client validation passed | 85.5 seconds | 3 claims, 1 rhetoric entry, 2 symbolic readings |

These successful baseline calls confirm access and that configuration works;
they do not reproduce or explain the original failed response. The recent Vercel
runtime-log and error queries returned no entries. Earlier Grok parsing failures
were handled application errors without diagnostic logs. The original cause
therefore remains unconfirmed. No further paid calls were made for validation.

## Corrections

- Parse only the final assistant message, concatenating its `output_text`
  fragments exactly. A preliminary message or a split JSON string no longer
  causes a valid final result to fail parsing.
- Reject explicitly unsuccessful response/message statuses, provider errors,
  refusals, and malformed final answers. Never reuse an earlier answer when the
  final one is unusable. Missing optional symbolic output remains an error when
  symbolic readings were requested.
- Ignore malformed citation metadata containers safely. Existing exact-excerpt,
  citation allowlist, and uncertainty rules still apply to every result.
- A genuine 120-second Grok request-cap expiry now returns localized HTTP 504,
  including during body reads. Shared-deadline precedence and cancellation
  cleanup remain intact; no retry, fallback, or budget increase is introduced.
- Log fixed failure phase/reason values, allowlisted statuses, structural counts,
  and only the names of missing required arrays. Submitted text, generated
  content, URLs, credentials, private error messages, and stacks are excluded.

The parser corrections are demonstrated by controlled regressions; they are not
presented as a proven explanation of this particular production failure.

## Validation

- Eight focused regressions cover multilingual fragmented final answers, earlier
  preambles, refusal and malformed-final rejection, unsuccessful statuses,
  malformed citation metadata, safe diagnostics, genuine timeouts versus caller
  cancellation, and public English/Hebrew/Russian HTTP 504 envelopes. The public
  timeout checks assert one provider call and exactly one lease release.
- Full local suite: 246 passed, eight real-Redis cases skipped because no local
  Redis container was available. Production build and `git diff --check` passed.
  CI supplies Redis 7.4 for the integration cases.
- Browser verification replayed the captured public-domain response through the
  actual public application handler and Grok adapter at desktop and 320px. The
  fixture added a preliminary assistant message and split the final JSON across
  two text blocks, retaining all fifteen annotations. Both runs returned HTTP
  200 and displayed three claims, three rhetoric findings, three symbolic
  readings, eight source links, Grok attribution, and the exact Hebrew input.
- A controlled request-cap expiry displayed the correct Hebrew HTTP 504 timeout
  message. All three fixture admissions released their leases. No page errors
  or external requests occurred. Browser skill was unavailable, so the checks
  used installed Playwright/Chrome against an owned local fixture server, which
  was closed afterward.

Implementation references: [xAI structured outputs](https://docs.x.ai/developers/model-capabilities/text/structured-outputs)
and [Responses API reference](https://docs.x.ai/developers/rest-api-reference/inference/responses).

The fix uses a new branch after PR #7 was merged. Existing source passages, fonts,
provider credentials, quotas, hosting limits, billing, and deployment settings
are unchanged. Only normal Git-triggered previews are created; the PR is not
merged automatically.
