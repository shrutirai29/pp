export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  jsonMode?: boolean;
}

export interface LLMProvider {
  readonly name: string;
  generateCompletion(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<string>;
}
