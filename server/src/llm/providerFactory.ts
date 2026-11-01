import { EnvConfig } from '../config/env.js';
import { LLMProvider } from './types.js';
import { MockLLMProvider } from './mockProvider.js';
import { OpenAICompatibleProvider } from './openaiProvider.js';

export function createLLMProvider(config: EnvConfig): LLMProvider {
  // If mock provider is explicitly selected
  if (!config.LLM_PROVIDER || config.LLM_PROVIDER === 'mock') {
    return new MockLLMProvider();
  }

  // In production, reject silent fallback if an external provider was requested without API key
  if (config.NODE_ENV === 'production' && !config.LLM_API_KEY) {
    throw new Error(
      `[LLM Provider] In production mode, LLM_API_KEY must be configured for provider '${config.LLM_PROVIDER}'. Silent fallback to mock is prohibited.`
    );
  }

  switch (config.LLM_PROVIDER) {
    case 'groq': {
      return new OpenAICompatibleProvider({
        apiKey: config.LLM_API_KEY,
        model: config.LLM_MODEL && config.LLM_MODEL !== 'mock-model-v1' ? config.LLM_MODEL : 'llama-3.3-70b-versatile',
        baseUrl: config.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
        timeoutMs: config.LLM_TIMEOUT_MS,
        maxRetries: config.LLM_MAX_RETRIES,
      });
    }

    case 'openai':
    case 'anthropic':
    case 'gemini': {
      // Explicitly return OpenAI-compatible HTTP client; do not silently fall back to mock
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
