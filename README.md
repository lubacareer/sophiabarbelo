# Sophia’s Mirror

Sophia’s Mirror explores factual claims and rhetorical techniques in text or a public article. It uses web search to find relevant sources, and presents rhetorical observations as interpretations—not proof of intent or a guarantee of neutrality. Claims without sufficient cited evidence remain unverified.

## Run locally

Requirements: Node.js `^22.22.2 || ^24.15.0 || >=26.0.0` and an xAI API key with access to Grok 4.7, web search, and structured outputs.

1. Run `npm install`.
2. Copy `.env.example` to `.env` and set `XAI_API_KEY` privately. Obtain a key from the [xAI console](https://console.x.ai/); never commit or share it. Analysis defaults to `grok-4.7`. Optionally set `XAI_MODEL` to another xAI model that supports web search and structured outputs.
3. Run `npm run dev`, then open the Vite address displayed in the terminal.

Grok 4.7 defaults to low reasoning effort to reduce latency. Set `XAI_REASONING_EFFORT` to `medium`, `high`, or `xhigh` to request more reasoning, which can take longer. For each Grok 4.7 analysis, the reasoning-depth selector can use the server default or choose Fast, Balanced, or Deep. These settings apply to Grok 4.7.

To use Groq instead, set `ANALYSIS_PROVIDER=groq` and configure `GROQ_API_KEY` from the [Groq console](https://console.groq.com/keys). The Groq model defaults to `openai/gpt-oss-20b` and can be changed with `GROQ_MODEL`. Check your provider's current usage limits and pricing, including web search, before use.

For a production-style local run, use `npm run build` followed by `npm start`; the app is served at http://127.0.0.1:3001. The server requires a loopback address; expose it through the proxy described below.

Run `npm test` to execute the server tests and `npm run build` to check the frontend build.

## Vercel deployment

For a personal, noncommercial project, Vercel Hobby can host the built frontend and Node API in two **separate** projects linked to this repository. The public project uses only Groq's free model tier; the private administrator project uses Grok 4.7 with the existing xAI account. Each project has a separate URL. The Vercel deployment does not use the Caddy administrator endpoint.

1. Create a **free-tier** Groq organization and verify both GPT-OSS 20B and GPT-OSS 120B, including browser search, are available on that free tier without a paid fallback. Create a separate free-tier [Upstash Redis](https://upstash.com/pricing/redis) database for distributed limits. Usage limits and provider terms may change; reaching them can make analyses unavailable.
2. Create the Vercel administrator project first, without enabling paid credentials or setting the protection confirmation. Under Security → Deployment Protection choose **Vercel Authentication: All Deployments**, with no protection exceptions or bypass tokens. Check that unauthenticated requests to the project root, `/api/config`, and `/api/analyze` are denied on both preview and production URLs. Do not add the administrator's secrets or set `SOPHIA_ADMIN_PROTECTION_CONFIRMED` until this has been verified.
3. Set administrator project's server-side secret environment variables: `SOPHIA_DEPLOYMENT_ROLE=admin`, `SOPHIA_ADMIN_PROTECTION_CONFIRMED=true`, `XAI_API_KEY`, `GROQ_API_KEY`, and `SOPHIA_GROQ_FREE_CONFIRMED=true` after the free-tier verification. Set `XAI_MODEL=grok-4.7` and optionally `XAI_REASONING_EFFORT=low`. Grok requests are billed under the existing xAI account; configuring this app does not change its budget. Redeploy, and repeat the unauthenticated checks for every deployment and domain.
4. Create the public project from the same repository. Set server-side secret variables `SOPHIA_DEPLOYMENT_ROLE=public`, `GROQ_API_KEY`, `SOPHIA_GROQ_FREE_CONFIRMED=true`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`. **Never add `XAI_API_KEY` or admin credentials to this project.** Verify the app and function through a protected preview before making the production URL public. Use separate preview secrets and enable Vercel Authentication for public-project preview deployments.
5. Enable Fluid Compute and confirm the Node runtime satisfies the version range in `package.json`; functions need time for web search and analysis. Check deployment protection, free-tier usage, and provider settings before each release. Never configure administrator deployment exceptions, public aliases, or protection bypass tokens. An admin role or confirmation variable alone does **not** protect a deployment.

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
