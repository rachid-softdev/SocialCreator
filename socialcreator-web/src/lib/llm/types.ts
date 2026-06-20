/**
 * LLM Provider Abstraction — Types
 */

export type LLMProviderId = "openai" | "anthropic";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  textContent: string;
  model: string;
  provider: LLMProviderId;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider: LLMProviderId,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}
