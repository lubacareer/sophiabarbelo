# Model picker validation

Verified on November 2, 2026 for PR #7. Provider credentials remain outside the repository.

## Shared extraction and analysis deadline correction

- Both deployed roles now start a 280-second monotonic work deadline at the analysis handler, before quota acquisition and URL extraction. A 250-second extraction leaves at most 30 seconds for research; standalone research retains its 240-second cap. The Vercel function limit remains 300 seconds and public leases remain 330 seconds.
- Controlled-clock and mocked-transport regressions cover late DNS completion/rejection, address fallback, redirects, Breaking The News extraction, native article-body/socket teardown, provider fetch/body cancellation, absolute expiry after synchronous parsing, safe localized HTTP 504 responses, and no later stages or late success. All four model dispatches forward the internal deadline on both deployed roles; local/Caddy options remain compatible.
- Cancellation waits for cooperative pipeline cleanup before releasing capacity. A new real Redis regression checks that both lease sets remain occupied through cleanup, then release while the admitted attempt stays charged to both counters. Release uses its existing independent five-second store timeout.
- Final local suite: **195 passed, eight Redis tests skipped**, zero failures. The local Docker engine is unavailable. [PR Checks](https://github.com/lubacareer/sophiabarbelo/pull/7/checks) run those tests against isolated Redis 7.4, including the new timeout cleanup regression.
- Production build and `git diff --check` passed. Independent review found an inherited private cancellation-message edge case; it is now canonicalized to the safe timeout message and covered by a regression.
- This correction used fixtures only, with no live model calls, credential or deployment-setting changes, manual deployments, or merge.

## Automated checks

- [GitHub Checks on the final runtime change](https://github.com/lubacareer/sophiabarbelo/actions/runs/41432931770): **167 tests passed, zero skipped**, including real Redis 7.4/Lua quota tests and four invalid-expiry subcases. The production build passed.
- Local suite: 154 passed; seven Redis cases skipped because the local Docker engine was unavailable. A subsequent loaded Windows run exposed an existing child-startup timeout; its test now allows fifteen seconds, checks spawn errors explicitly, and still requires the host-guard rejection exit and message.
- `git diff --check` passed. No dependencies were added.
- Provider tests use mocked transports for exact model/endpoint selection, missing configuration, invalid selections before admission, no fallback, safe citation metadata, exact multilingual excerpts, malformed/truncated responses, quota failures, and shared deadlines.
- Failure diagnostics log only an allowlisted provider hostname and numeric HTTP status. Tests confirm that keys, account IDs, input, paths, and provider error bodies are not logged.
- The real Redis HTTP regression changes among all four model IDs across two public server instances and one IPv6 /64, confirming that changing models does not reset either counter. Success and failure release both lease sets; administrator requests bypass the public limiter.

## Browser checks

Headless Playwright with installed Chrome tested deterministic loopback fixtures of the production build. No fixture calls an analysis provider or the production Redis store. The integrated browser was also used for interaction checks; its viewport override did not produce reliable screenshots, so responsive validation used isolated headless Chrome.

- **18 viewport/locale cases:** public and admin configurations, 1280px/390px/320px widths, English/Hebrew/Russian. No horizontal or control overflow and no browser console errors.
- Same four model choices and Luna default on separate origins; keyboard selection and persisted selection after reload.
- Inputs and results survive next-model changes; the result's model label remains attached to the model used for that result.
- In-flight controls are disabled. Failed configuration blocks submission and Retry recovers. A remembered unavailable model remains selected and cannot submit until an available choice is explicitly selected.
- Public Grok exposes no depth selector. Administrator Grok accepts its selected depth; switching models clears stale depth and omits it from the next request.
- The legacy local configuration hides the deployed picker and sends the original request shape.

Screenshots were inspected for Russian at 320px and Hebrew administrator controls at 390px. Temporary screenshots and the fixture runner remain outside the repository.

## Provider account and deployment checks

- Gemini: the selected project has no linked billing account. The model-list API recognizes Gemini 3.8 Flash, but live inference could not be verified successfully; its activation confirmation is off.
- Cloudflare: Workers Free is active. The saved token is active and the selected account's Workers AI model-list request succeeds.
- Tavily: Researcher, 1,000 monthly credits, PAYGO off. A Development key validates through its usage endpoint.
- OpenAI and xAI credentials validate for their selected model endpoints. API usage still consumes those providers' credits/budgets.
- Both projects retain their existing Vercel Authentication protection. Unauthenticated configuration requests redirect to authentication (HTTP 302). No bypass links, protection exceptions, or billing changes were created.
- Server-only credentials are configured for both projects' branch-specific Preview and Production environments. Luna, Grok, and GLM have verified activation settings. Gemini's confirmation is explicitly false in both environments pending a successful free inference. Existing Groq variables remain untouched for rollback compatibility, while new deployed code never uses them.

## Live smoke checks

Exactly eight end-to-end analyses were submitted through authenticated Git-triggered previews, one per model per domain. Each used the short public sample: "The Earth orbits the Sun once every year." Results were checked for response/model attribution and returned source links without requiring a predetermined assessment.

| Model | Public preview | Administrator preview | Example returned source |
| --- | --- | --- | --- |
| Luna | HTTP 200 | HTTP 200 | [NASA Earth fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html) |
| GLM-4.7-Flash + Tavily | HTTP 200 | HTTP 200 | Public: [NASA Orbits and Kepler's Laws](https://science.nasa.gov/solar-system/orbits-and-keplers-laws); admin: [History: Copernicus](https://www.history.com/articles/nicolaus-copernicus) |
| Grok 4.7 | HTTP 200 | HTTP 200 with the Fast depth option | [NASA Earth facts](https://science.nasa.gov/earth/facts/); admin also returned [NASA Space Place](https://spaceplace.nasa.gov/years-on-other-planets/) |
| Gemini 3.8 Flash + Tavily | HTTP 502; safe server diagnostics recorded Google HTTP 503 | HTTP 502 before status-only diagnostics were added | No result or fallback; activation disabled |

Citation examples omit tracking parameters for readability. GLM also cited Q&A/aggregator pages, including a Hubble-orbit question unrelated to the submitted Earth-orbit claim. Passing the URL-provenance check does not establish that every linked page supports the model's explanation; source relevance remains a model-quality limitation requiring human review.

One additional minimal Gemini request-format probe timed out after 45 seconds without a response. It did not run the research pipeline. The documented request format and account access were reviewed, but neither key/model listing nor a consumer Ultra subscription proves a successful free API inference. No further full analyses were submitted after the eight-test limit.

Production values are staged for the next deployment, with Gemini disabled. Existing deployed environment snapshots and live routing remain unchanged. PR #7 remains unmerged; there have been no manual deployments.
