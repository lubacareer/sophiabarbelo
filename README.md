# Sophia’s Mirror

Sophia’s Mirror explores factual claims and rhetorical techniques in text or a public article. It uses Grok web search to find relevant sources, and presents rhetorical observations as interpretations—not proof of intent or a guarantee of neutrality. Claims without sufficient cited evidence remain unverified.

## Run locally

Requirements: Node.js 22 or newer and an xAI API key with access to a Grok model supporting web search and structured outputs.

1. Run `npm install`.
2. Copy `.env.example` to `.env` and set `XAI_API_KEY` privately. Never commit or share the key. Optionally set `XAI_MODEL`.
3. Run `npm run dev`, then open the Vite address displayed in the terminal.

For a production-style local run, use `npm run build` followed by `npm start`; the app is served at http://127.0.0.1:3001. The server binds to localhost by default. If deploying elsewhere, configure `HOST`, `PORT`, and `ALLOWED_HOSTS` (a comma-separated list of allowed hostnames) for the deployment environment.

Run `npm test` to execute the server tests and `npm run build` to check the frontend build.

## How it works

The server accepts text or retrieves an HTML article from a public HTTP(S) URL. It limits downloads, rejects local and private network destinations, validates redirects and pins DNS addresses when connecting. Grok receives the article text and performs web research; the application returns quoted excerpts, claim assessments with source links, and rhetorical observations. Content and prompts sent to xAI are subject to its service terms and data practices. No analysis history is stored by the app.

Search results and model output can be incomplete or mistaken. The app checks that evidence links occur among the provider’s reported citations, but does not independently establish that each source supports a claim. Review the sources and context yourself.
