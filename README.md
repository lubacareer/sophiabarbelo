# Sophia’s Mirror

Sophia’s Mirror explores factual claims and rhetorical techniques in text or a public article. It uses web search to find relevant sources, and presents rhetorical observations as interpretations—not proof of intent or a guarantee of neutrality. Claims without sufficient cited evidence remain unverified.

## Pleroma 3D

Open **Pleroma 3D** in the navigation to explore the Secret Book of John, Ezekiel’s wheels, a ten-sefirot Tree of Life schematic, and Plotinus’s principles. The explorer has a Three.js / React Three Fiber 3D view and an interactive SVG 2D view, with exact credited source passages and separate English, Hebrew, and Russian editorial explanations. Mobile starts in 2D; unavailable or lost WebGL falls back to the same interactive map and source inspector.

All diagram connections are curved. Selecting a figure illuminates it and briefly sends light along its connections; reduced-motion preferences retain a static view. Zoom, Fit, layer controls, and List view provide alternatives to dragging the 3D camera. Switching back to Analyze preserves the current input and results.

Interpretive overlays are optional and off by default: twelve sourced aeons can be drawn as twenty-four modern masculine/feminine aspect markers; Cicero’s classical planetary ordering is shown separately from the seven Gnostic heavens; torus forms are a modern geometric reading of Ezekiel’s wheels. Spatial layouts and Tree connectors are editorial reconstructions, not claims that these traditions describe identical entities or physical cosmic distances.

Source passages and graphics are bundled locally. Exploring does not call an analysis provider, use Redis, or consume model credits. The 3D renderer loads only when 3D is selected. Bookmarkable query parameters preserve the site's pathname and analysis finding anchors. See [source editions and reuse provenance](docs/pleroma-sources.md) and [the design specification](docs/pleroma-design.md).

## Run locally

Requirements: Node.js `^22.22.2 || ^24.15.0 || >=26.0.0` and an xAI API key with access to Grok 4.7, web search, and structured outputs.

1. Run `npm install`.
2. Copy `.env.example` to `.env` and set `XAI_API_KEY` privately. Obtain a key from the [xAI console](https://console.x.ai/); never commit or share it. Analysis defaults to `grok-4.7`. Optionally set `XAI_MODEL` to another xAI model that supports web search and structured outputs.
3. Run `npm run dev`, then open the Vite address displayed in the terminal.

Grok 4.7 defaults to low reasoning effort to reduce latency. Set `XAI_REASONING_EFFORT` to `medium`, `high`, or `xhigh` to request more reasoning, which can take longer. For each Grok 4.7 analysis, the reasoning-depth selector can use the server default or choose Fast, Balanced, or Deep. These settings apply to Grok 4.7.

To use Groq instead, set `ANALYSIS_PROVIDER=groq` and configure `GROQ_API_KEY` from the [Groq console](https://console.groq.com/keys). The Groq model defaults to `openai/gpt-oss-120b` and can be changed with `GROQ_MODEL`. Check your provider's current usage limits and pricing, including web search, before use.

To try OpenAI instead, set `ANALYSIS_PROVIDER=openai` and configure `OPENAI_API_KEY` privately. The default is `gpt-6-luna`; `OPENAI_MODEL` changes the local model. Each analysis uses three model requests and up to three web-search tool calls, which consume API credits and may incur charges. Confirm your balance, limits and [current model and search pricing](https://developers.openai.com/api/docs/pricing) before use. Subscription API credits must be claimed and linked to the API organization; the signed-in Codex allowance is separate. Live compatibility and output quality should be verified before public use.

For a production-style local run, use `npm run build` followed by `npm start`; the app is served at http://127.0.0.1:3001. The server requires a loopback address; expose it through the proxy described below.

Run `npm test` to execute the server tests and `npm run build` to check the frontend build.

The public quota integration tests execute the real Lua scripts against an isolated Redis on loopback. CI starts Redis automatically. Locally, start a disposable instance and opt in before running the tests (PowerShell):

```powershell
docker run --detach --rm --name sophia-quota-tests --publish 127.0.0.1:56379:6379 redis:7.4-alpine
$env:SOPHIA_TEST_REDIS_PORT = '56379'
npm test
docker stop sophia-quota-tests
Remove-Item Env:SOPHIA_TEST_REDIS_PORT
```

Without `SOPHIA_TEST_REDIS_PORT`, these integration tests are skipped. They use only UUID-prefixed test keys on `127.0.0.1`, clean up those keys, and never use the app's Redis credentials or real analysis providers.

## Vercel deployment

For a personal, noncommercial project, Vercel Hobby can host the built frontend and Node API in two **separate** projects linked to this repository. Keep `sophiabarbelo` and `sophiabarbelo.vercel.app` for the public website, and use `sophiabarbelo-admin` for private administrator access. The public project defaults to verified free Groq access; an explicitly configured OpenAI option is described below. The administrator project uses Grok 4.7 with the existing xAI account. The Vercel deployment does not use the Caddy administrator endpoint.

The article extractor's `jsdom` dependency needs Node's support for `require()` of ES modules, which [Vercel disables by default](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration). The committed configuration enables it with the nonsecret setting `NODE_OPTIONS=--experimental-require-module`. Configure the same setting in both Vercel projects and redeploy; if `NODE_OPTIONS` already contains other flags, preserve them and replace any conflicting `--no-experimental-require-module` flag. This avoids the startup `ERR_REQUIRE_ESM` without changing dependencies.

1. Create `sophiabarbelo-admin` from the same repository, without paid credentials or the protection confirmation. Under Security → Deployment Protection choose **Vercel Authentication: All Deployments**, with no protection exceptions or bypass tokens. Check that unauthenticated requests to `/`, GET `/api/config`, and POST `/api/analyze` require Vercel login or are denied on its preview, production, deployment, and alias URLs. Do not add the administrator's secrets or set `SOPHIA_ADMIN_PROTECTION_CONFIRMED` until this has been verified.
2. Set the administrator project's server-side variables `SOPHIA_DEPLOYMENT_ROLE=admin`, `SOPHIA_ADMIN_PROTECTION_CONFIRMED=true`, and secret `XAI_API_KEY`. Grok 4.7 is fixed for this deployment; optionally set `XAI_REASONING_EFFORT=low`. Redeploy and repeat the unauthenticated checks, then sign in and test text and URL analysis, citations, and reasoning controls. Grok requests use the existing xAI budget; configuring the app does not change billing settings. Administrator analysis does not require Upstash or Groq credentials.
3. Keep public analysis disabled until a **free-tier** Groq organization has been verified to include GPT-OSS 120B browser search without paid fallback, and a separate free-tier [Upstash Redis](https://upstash.com/pricing/redis) database exists. Do not set `SOPHIA_GROQ_FREE_CONFIRMED=true` before that verification. The public service uses GPT-OSS 120B only; rate limits or unavailable browser search can make analysis unavailable.
4. Configure the public `sophiabarbelo` project with `SOPHIA_DEPLOYMENT_ROLE=public` and, only after verification, secret `GROQ_API_KEY`, `SOPHIA_GROQ_FREE_CONFIRMED=true`, `UPSTASH_REDIS_REST_URL`, and secret `UPSTASH_REDIS_REST_TOKEN`. **Never add `XAI_API_KEY` or admin credentials to this project or import the local `.env`.** Verify the app and function through a protected preview before enabling public analysis. Use separate preview secrets and enable Vercel Authentication for public-project previews.
5. If administrator free-model fallback is desired, add its secret `GROQ_API_KEY` and `SOPHIA_GROQ_FREE_CONFIRMED=true` only after the same free-tier verification. Without those settings, Grok rate limits produce an unavailable message rather than an unverified or paid fallback.
6. Enable Fluid Compute and confirm the Node runtime satisfies the version range in `package.json`. After every release, check `/api/config` and a small analysis, inspect runtime errors, and repeat the administrator unauthenticated checks. An unconfigured API should return the app's clear `503` response; `FUNCTION_INVOCATION_FAILED` indicates a runtime failure to investigate before adding credentials. Never configure administrator protection exceptions, public aliases, or bypass tokens. The admin role and confirmation variable do **not** replace Vercel Authentication.

To select OpenAI for the public project instead of the default Groq route, explicitly configure `SOPHIA_PUBLIC_PROVIDER=openai`, `SOPHIA_OPENAI_COSTS_CONFIRMED=true`, and a secret `OPENAI_API_KEY` in that project, together with the shared Upstash settings above. The public model is fixed to `gpt-6-luna` regardless of `OPENAI_MODEL`. This opt-in permits billable model and web-search requests; configure appropriate provider-side spend limits and check the linked API organization's credit balance first. The administrator route and its free Groq fallback are unchanged. Do not enable this option until its API and citation behavior have been verified on a protected preview.

Public requests use shared Redis allowances of **five admitted analysis attempts per 10-minute window** and **30 per 24-hour window**, with at most **two concurrent analyses per client** and **three across the public site**. Each window starts with its first admitted attempt and keeps its own expiry. A client is one public IPv4 address or IPv6 `/64` network, so visitors on the same network can share an allowance. The existing research settings and input allowance remain in use.

Extraction and provider failures count as admitted attempts; requests rejected by initial input validation or quota/capacity checks do not. Exhausted allowances return HTTP 429 with `Retry-After`; the daily allowance has a distinct localized message. The service fails closed if Redis is unavailable. Redis stores hashed network quota identifiers, counters, and temporary leases for up to 24 hours; it does not store submitted text or analysis results. The administrator project bypasses those application limits but remains subject to provider and hosting limits.

Keep Redis credentials and all provider keys private. Public requests send submitted text to Groq by default when `SOPHIA_GROQ_FREE_CONFIRMED=true`, or to OpenAI when `SOPHIA_PUBLIC_PROVIDER=openai` and `SOPHIA_OPENAI_COSTS_CONFIRMED=true` are configured. Administrator requests send text to xAI first and may also send it to Groq after an xAI rate limit when the confirmed free Groq fallback is configured. Local requests send text to the provider selected by `ANALYSIS_PROVIDER`, which defaults to xAI. Review each applicable provider's terms and data policies before submitting private material.

## Caddy deployment and administrator access

The included `Caddyfile` uses the free Caddy web server on the **same machine** as the Node server. Caddy serves HTTPS and proxies to the loopback-only app at `127.0.0.1:3001`; it does not expose the Node port to the internet. Set up DNS and firewall access to ports 80 and 443 for Caddy's automatic public certificates. Hosting and domain registration may have separate costs.

1. Install [Caddy](https://caddyserver.com/docs/install) and run `npm install` and `npm run build` on the server.
2. In the private `.env` file, set `SOPHIA_DOMAIN` to your domain, `ALLOWED_HOSTS` to that domain's hostname, `SOPHIA_ADMIN_USER` to your administrator username, and `SOPHIA_ADMIN_HASH` to a bcrypt hash generated by `caddy hash-password`. Use a strong unique password; never store the plaintext password in the repository.
3. Generate a random proxy secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and set it as `SOPHIA_PROXY_SECRET` in `.env`. Keep this value private. The Node server and Caddy must use the same secret. Leave `HOST=127.0.0.1` and `PORT=3001`; if changing the port, also update the Caddyfile's upstream addresses.
4. Start the app with `npm start`, then run `caddy run --config Caddyfile --envfile .env` in another terminal. Caddy must be the first public proxy and must reach the Node server over loopback; do not expose the backend or place an untrusted proxy or CDN in front of Caddy. Keep Caddy's default credential redaction enabled; do not enable its `log_credentials` option.
5. Visitors can use `https://<your-domain>/`. Open `https://<your-domain>/admin/` and enter your administrator credentials when prompted; analyses from that page bypass the app's anonymous limits. Browser Basic Authentication credentials are cached by the browser; close the browser or use a private window if you need to end that session.

Anonymous clients are limited to 10 analyses per 10 minutes, and at most three anonymous analyses can run concurrently per server. Limits use in-memory storage, reset on restart, and are not shared across multiple server instances. They are not a spending ceiling; configure provider-side budgets or alerts if needed. Administrator requests have no application rate or concurrency limits. The proxy strips and replaces incoming identity headers; the Node server trusts them only when they come from loopback and carry the shared secret.

To try Caddy locally, leave `SOPHIA_DOMAIN=localhost` and visit `https://localhost/admin/` after configuring the credentials and secret. Caddy uses a local certificate for localhost, which your browser must trust. Never use Basic Authentication over public plain HTTP.

## How it works

The server accepts text or retrieves an HTML article from a public HTTP(S) URL. It limits downloads, rejects local and private network destinations, validates redirects and pins DNS addresses when connecting. The configured provider receives the article text and performs web research; the application returns quoted excerpts, claim assessments with source links, and rhetorical observations. Groq and OpenAI use separate search and structured-analysis calls. Content and prompts sent to the provider are subject to its service terms and data practices. No analysis history is stored by the app.

Search results and model output can be incomplete or mistaken. The app checks that evidence links occur among the provider’s reported citations, but does not independently establish that each source supports a claim. Review the sources and context yourself.

## Languages, demos, and annotations

Use the English / עברית / Русский selector to change the interface and the language of new analysis explanations. Only the language preference is saved locally. Source text and quoted excerpts are never translated. Hebrew uses a right-to-left interface; mixed-language excerpts keep their own direction. Existing analysis keeps its original language until you press Analyze again.

The four built-in examples cover Job’s three friends, Job 38’s whirlwind speech, a Panarion adaptation, and a dated adaptation of Walla’s viral hospital-photo report. Bible passages use the public-domain World English Bible, Westminster Leningrad Codex, and Russian Synodal editions. Every example displays its references and attribution; modern adaptations are explicitly labeled, not presented as quotations. Loading a demo does not submit it or predetermine findings.

After analysis, switch between Edit and Highlights in the input panel. Only exact excerpts with commentary are annotated: lilac means supported by cited evidence, red means a contradicted claim or an explained reasoning failure, and a neutral underline means uncertainty or another rhetorical observation. Numbered links lead to the corresponding findings; color is not the only indicator. Rhetorical techniques do not automatically establish logical errors. Editing the source or loading a new demo clears the previous result.

`POST /api/analyze` accepts optional `language` (`en`, `he`, or `ru`); omitting it preserves the previous input-language behavior. Successful responses add server-authored `sourceText`; rhetoric observations add stable `categoryId` and `isReasoningFlaw` fields while retaining the category display text. These additions do not change citation checks, provider routing, or application limits.
