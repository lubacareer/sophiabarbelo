# Model picker validation

Verified on November 2, 2026 for PR #7. Provider credentials remain outside the repository.

## Automated checks

- [GitHub Checks run 38](https://github.com/lubacareer/sophiabarbelo/actions/runs/41431218289): **165 tests passed, zero skipped**, including real Redis 7.4/Lua quota tests and four invalid-expiry subcases. The production build passed.
- Local suite: 154 passed; seven Redis cases skipped because the local Docker engine was unavailable. A subsequent loaded Windows run exposed an existing child-startup timeout; its test now allows fifteen seconds, checks spawn errors explicitly, and still requires the host-guard rejection exit and message.
- `git diff --check` passed. No dependencies were added.
- Provider tests use mocked transports for exact model/endpoint selection, missing configuration, invalid selections before admission, no fallback, safe citation metadata, exact multilingual excerpts, malformed/truncated responses, quota failures, and shared deadlines.
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

- Gemini: the selected project has no linked billing account. The model-list API recognizes Gemini 3.8 Flash; live inference eligibility still requires the smoke test below.
- Cloudflare: Workers Free is active. The saved token is active and the selected account's Workers AI model-list request succeeds.
- Tavily: Researcher, 1,000 monthly credits, PAYGO off. A Development key validates through its usage endpoint.
- OpenAI and xAI credentials validate for their selected model endpoints. API usage still consumes those providers' credits/budgets.
- Both projects retain their existing Vercel Authentication protection. Branch-specific Preview credentials and only verified confirmations are configured; no bypass links, protection exceptions, or billing changes were created.

## Live smoke checks

Pending fresh Git-triggered previews that include the verified provider variables. The limit is eight short analyses total, one per model per domain. Record outcomes and returned citations here without requiring a predetermined assessment.

Production variables have not yet been staged. PR #7 remains unmerged; there have been no manual deployments.
