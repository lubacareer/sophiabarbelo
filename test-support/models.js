// Fake server configuration for tests that inject provider stubs. This still
// exercises the production catalog/availability checks without real accounts.
export const modelEnvironment = Object.freeze({
  OPENAI_API_KEY: 'test-openai-key',
  SOPHIA_OPENAI_COSTS_CONFIRMED: 'true',
  GEMINI_API_KEY: 'test-gemini-key',
  SOPHIA_GEMINI_FREE_CONFIRMED: 'true',
  TAVILY_API_KEY: 'test-tavily-key',
  SOPHIA_TAVILY_FREE_CONFIRMED: 'true',
  CLOUDFLARE_API_TOKEN: 'test-cloudflare-token',
  CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
  SOPHIA_CLOUDFLARE_FREE_CONFIRMED: 'true',
  XAI_API_KEY: 'test-xai-key',
  SOPHIA_PUBLIC_XAI_COSTS_CONFIRMED: 'true',
});
