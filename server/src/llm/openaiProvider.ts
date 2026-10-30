import { LLMMessage, LLMCompletionOptions, LLMProvider } from './types.js';

export interface OpenAICompatibleConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Universal OpenAI-Compatible HTTP Provider.
 * Works seamlessly with OpenAI (gpt-4o, gpt-4o-mini), Groq, Ollama, DeepSeek,
 * and Gemini/Anthropic OpenAI-compatible bridges.
 *
 * Security:
 * - API keys remain strictly backend-only.
 * - Never logs secrets or authorization headers.
 * - Enforces bounded retries and timeout aborts.
 */
export class OpenAICompatibleProvider implements LLMProvider {
  public readonly name = 'openai-compatible-provider';
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(config: OpenAICompatibleConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4o-mini';
    this.baseUrl = config.baseUrl?.replace(/\/+$/, '') || 'https://api.openai.com/v1';
    this.timeoutMs = config.timeoutMs ?? 15000;
    this.maxRetries = config.maxRetries ?? 2;
  }

  public async generateCompletion(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('LLM Provider Error: API key is not configured on the backend.');
    }

    const timeout = options?.timeoutMs ?? this.timeoutMs;
    const temperature = options?.temperature ?? 0.3;
    const maxTokens = options?.maxTokens ?? 1000;
    const jsonMode = options?.jsonMode ?? true;

    const requestBody: Record<string, any> = {
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature,
      max_tokens: maxTokens,
    };

    if (jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    let lastError: Error | null = null;
    const url = `${this.baseUrl}/chat/completions`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const errStatus = response.status;
          let errText = '';
          try {
            const errJson: any = await response.json();
            errText = errJson?.error?.message || response.statusText;
          } catch {
            errText = response.statusText;
          }

          // Do NOT log the API key or raw Authorization header
          const providerErr = new Error(`LLM provider HTTP ${errStatus}: ${errText}`);
          (providerErr as any).status = errStatus;

          // Only retry on transient rate limits (429) or server errors (500, 502, 503, 504)
          if ((errStatus === 429 || errStatus >= 500) && attempt < this.maxRetries) {
            lastError = providerErr;
            const backoffMs = Math.min(2000, 300 * Math.pow(2, attempt));
            await new Promise((res) => setTimeout(res, backoffMs));
            continue;
          }

          throw providerErr;
        }

        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          throw new Error('LLM provider returned empty or malformed completion choice');
        }

        return content;
      } catch (err: any) {
        clearTimeout(timer);

        if (err.name === 'AbortError') {
          lastError = new Error(`LLM provider request timed out after ${timeout}ms`);
        } else {
          lastError = err;
        }

        if (attempt < this.maxRetries) {
          const backoffMs = Math.min(2000, 300 * Math.pow(2, attempt));
          await new Promise((res) => setTimeout(res, backoffMs));
          continue;
        }
      }
    }

    throw lastError || new Error('LLM Provider request failed after bounded retries');
  }
}
