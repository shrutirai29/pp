import { EnvConfig } from '../config/env.js';
import { LLMProvider } from './types.js';
import { MockLLMProvider } from './mockProvider.js';
import { OpenAICompatibleProvider } from './openaiProvider.js';

export function createLLMProvider(config: EnvConfig): LLMProvider {
  // In production, reject silent fallback if an external provider was requested without API key
  if (config.NODE_ENV === 'production' && config.LLM_PROVIDER !== 'mock' && !config.LLM_API_KEY) {
    throw new Error(
      `[LLM Provider] In production mode, LLM_API_KEY must be configured for provider '${config.LLM_PROVIDER}'. Silent fallback to mock is prohibited.`
    );
  }

  // If provider is explicitly set to mock, or if api key is missing in dev mode, use mock
  if (!config.LLM_PROVIDER || config.LLM_PROVIDER === 'mock' || !config.LLM_API_KEY) {
    if (config.LLM_PROVIDER && config.LLM_PROVIDER !== 'mock' && !config.LLM_API_KEY) {
      console.warn(
        `[LLM Provider] Provider '${config.LLM_PROVIDER}' configured but LLM_API_KEY is missing. Falling back to deterministic MockLLMProvider in development.`
      );
    }
    return new MockLLMProvider();
  }

  switch (config.LLM_PROVIDER) {
    case 'openai':
    case 'anthropic':
    case 'gemini': {
      // Standard OpenAI-compatible client
      // For Gemini or Anthropic, custom base URLs or bridges can be passed in LLM_BASE_URL
      return new OpenAICompatibleProvider({
        apiKey: config.LLM_API_KEY,
        model: config.LLM_MODEL,
        baseUrl: config.LLM_BASE_URL || undefined,
        timeoutMs: config.LLM_TIMEOUT_MS,
        maxRetries: config.LLM_MAX_RETRIES,
      });
    }

    default:
      return new MockLLMProvider();
  }
}
