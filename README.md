# Sophia’s Mirror

Sophia’s Mirror explores factual claims and rhetorical techniques in text or a public article. It uses web search to find relevant sources, and presents rhetorical observations as interpretations—not proof of intent or a guarantee of neutrality. Claims without sufficient cited evidence remain unverified.

## Run locally

Requirements: Node.js `^22.22.2 || ^24.15.0 || >=26.0.0` and an xAI API key with access to Grok 4.7, web search, and structured outputs.

1. Run `npm install`.
2. Copy `.env.example` to `.env` and set `XAI_API_KEY` privately. Obtain a key from the [xAI console](https://console.x.ai/); never commit or share it. Analysis defaults to `grok-4.7`. Optionally set `XAI_MODEL` to another xAI model that supports web search and structured outputs.
3. Run `npm run dev`, then open the Vite address displayed in the terminal.

Grok 4.7 defaults to low reasoning effort to reduce latency. Set `XAI_REASONING_EFFORT` to `medium`, `high`, or `xhigh` to request more reasoning, which can take longer. For each Grok 4.7 analysis, the reasoning-depth selector can use the server default or choose Fast, Balanced, or Deep. These settings apply to Grok 4.7.

To use Groq instead, set `ANALYSIS_PROVIDER=groq` and configure `GROQ_API_KEY` from the [Groq console](https://console.groq.com/keys). The Groq model defaults to `openai/gpt-oss-120b` and can be changed with `GROQ_MODEL`. Check your provider's current usage limits and pricing, including web search, before use.

For a production-style local run, use `npm run build` followed by `npm start`; the app is served at http://127.0.0.1:3001. The server requires a loopback address; expose it through the proxy described below.

Run `npm test` to execute the server tests and `npm run build` to check the frontend build.

## Vercel deployment

For a personal, noncommercial project, Vercel Hobby can host the built frontend and Node API in two **separate** projects linked to this repository. Keep `sophiabarbelo` and `sophiabarbelo.vercel.app` for the public website, and use `sophiabarbelo-admin` for private administrator access. The public project uses only verified free Groq access; the administrator project uses Grok 4.7 with the existing xAI account. The Vercel deployment does not use the Caddy administrator endpoint.

The article extractor's `jsdom` dependency needs Node's support for `require()` of ES modules, which [Vercel disables by default](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration). The committed configuration enables it with the nonsecret setting `NODE_OPTIONS=--experimental-require-module`. Configure the same setting in both Vercel projects and redeploy; if `NODE_OPTIONS` already contains other flags, preserve them and replace any conflicting `--no-experimental-require-module` flag. This avoids the startup `ERR_REQUIRE_ESM` without changing dependencies.

1. Create `sophiabarbelo-admin` from the same repository, without paid credentials or the protection confirmation. Under Security → Deployment Protection choose **Vercel Authentication: All Deployments**, with no protection exceptions or bypass tokens. Check that unauthenticated requests to `/`, GET `/api/config`, and POST `/api/analyze` require Vercel login or are denied on its preview, production, deployment, and alias URLs. Do not add the administrator's secrets or set `SOPHIA_ADMIN_PROTECTION_CONFIRMED` until this has been verified.
2. Set the administrator project's server-side variables `SOPHIA_DEPLOYMENT_ROLE=admin`, `SOPHIA_ADMIN_PROTECTION_CONFIRMED=true`, and secret `XAI_API_KEY`. Grok 4.7 is fixed for this deployment; optionally set `XAI_REASONING_EFFORT=low`. Redeploy and repeat the unauthenticated checks, then sign in and test text and URL analysis, citations, and reasoning controls. Grok requests use the existing xAI budget; configuring the app does not change billing settings. Administrator analysis does not require Upstash or Groq credentials.
3. Keep public analysis disabled until a **free-tier** Groq organization has been verified to include GPT-OSS 120B browser search without paid fallback, and a separate free-tier [Upstash Redis](https://upstash.com/pricing/redis) database exists. Do not set `SOPHIA_GROQ_FREE_CONFIRMED=true` before that verification. The public service uses GPT-OSS 120B only; rate limits or unavailable browser search can make analysis unavailable.
4. Configure the public `sophiabarbelo` project with `SOPHIA_DEPLOYMENT_ROLE=public` and, only after verification, secret `GROQ_API_KEY`, `SOPHIA_GROQ_FREE_CONFIRMED=true`, `UPSTASH_REDIS_REST_URL`, and secret `UPSTASH_REDIS_REST_TOKEN`. **Never add `XAI_API_KEY` or admin credentials to this project or import the local `.env`.** Verify the app and function through a protected preview before enabling public analysis. Use separate preview secrets and enable Vercel Authentication for public-project previews.
5. If administrator free-model fallback is desired, add its secret `GROQ_API_KEY` and `SOPHIA_GROQ_FREE_CONFIRMED=true` only after the same free-tier verification. Without those settings, Grok rate limits produce an unavailable message rather than an unverified or paid fallback.
6. Enable Fluid Compute and confirm the Node runtime satisfies the version range in `package.json`. After every release, check `/api/config` and a small analysis, inspect runtime errors, and repeat the administrator unauthenticated checks. An unconfigured API should return the app's clear `503` response; `FUNCTION_INVOCATION_FAILED` indicates a runtime failure to investigate before adding credentials. Never configure administrator protection exceptions, public aliases, or bypass tokens. The admin role and confirmation variable do **not** replace Vercel Authentication.

Public requests use a shared Redis quota of ten analyses per client per ten minutes and a maximum of three concurrent analyses. The service fails closed if the shared store is unavailable. The administrator project bypasses those application limits but remains subject to provider and hosting limits. Keep Redis credentials and both provider keys private. Groq and xAI receive the submitted text under their respective terms and data policies; review those policies before submitting private material.

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

The server accepts text or retrieves an HTML article from a public HTTP(S) URL. It limits downloads, rejects local and private network destinations, validates redirects and pins DNS addresses when connecting. The configured provider receives the article text and performs web research; the application returns quoted excerpts, claim assessments with source links, and rhetorical observations. Groq uses separate search and structured-analysis calls. Content and prompts sent to the provider are subject to its service terms and data practices. No analysis history is stored by the app.

Search results and model output can be incomplete or mistaken. The app checks that evidence links occur among the provider’s reported citations, but does not independently establish that each source supports a claim. Review the sources and context yourself.

## Languages, demos, and annotations

Use the English / עברית / Русский selector to change the interface and the language of new analysis explanations. Only the language preference is saved locally. Source text and quoted excerpts are never translated. Hebrew uses a right-to-left interface; mixed-language excerpts keep their own direction. Existing analysis keeps its original language until you press Analyze again.

The four built-in examples cover Job’s three friends, Job 38’s whirlwind speech, a Panarion adaptation, and a dated adaptation of Walla’s viral hospital-photo report. Bible passages use the public-domain World English Bible, Westminster Leningrad Codex, and Russian Synodal editions. Every example displays its references and attribution; modern adaptations are explicitly labeled, not presented as quotations. Loading a demo does not submit it or predetermine findings.

After analysis, switch between Edit and Highlights in the input panel. Only exact excerpts with commentary are annotated: lilac means supported by cited evidence, red means a contradicted claim or an explained reasoning failure, and a neutral underline means uncertainty or another rhetorical observation. Numbered links lead to the corresponding findings; color is not the only indicator. Rhetorical techniques do not automatically establish logical errors. Editing the source or loading a new demo clears the previous result.

`POST /api/analyze` accepts optional `language` (`en`, `he`, or `ru`); omitting it preserves the previous input-language behavior. Successful responses add server-authored `sourceText`; rhetoric observations add stable `categoryId` and `isReasoningFlaw` fields while retaining the category display text. These additions do not change citation checks, provider routing, or application limits.
