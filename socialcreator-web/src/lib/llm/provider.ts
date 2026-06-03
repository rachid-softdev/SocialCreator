/**
 * LLM Provider Abstraction — Provider
 * Primary: Anthropic (default) or OpenAI (based on strategy)
 * Fallback: If primary fails with a retryable error, try the fallback
 */

import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "@/lib/utils/retry";
import type { LLMProviderId, LLMRequest, LLMResponse } from "./types";
import { LLMError } from "./types";

// ── Default model mappings ─────────────────────────────────────

const DEFAULT_MODELS: Record<LLMProviderId, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
};

// ─── Anthropic SDK instance (lazy-init) ────────────────────────

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 60_000,
    });
  }
  return anthropicClient;
}

// ── OpenAI fetch helper ─────────────────────────────────────────

async function callOpenAI(request: LLMRequest): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new LLMError("OPENAI_API_KEY is not configured", "openai", undefined, false);
  }

  const model = request.model ?? DEFAULT_MODELS.openai;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature ?? 0.8,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const body = await response.text();
    const retryable = status === 429 || (status >= 500 && status < 600);
    throw new LLMError(`OpenAI API error (${status}): ${body}`, "openai", status, retryable);
  }

  const data = (await response.json()) as {
    model: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    choices: Array<{ message: { content: string | null } }>;
  };

  const textContent = data.choices[0]?.message?.content ?? "";

  return {
    textContent,
    model: data.model,
    provider: "openai",
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

// ── Anthropic SDK call ──────────────────────────────────────────

async function callAnthropic(request: LLMRequest): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new LLMError("ANTHROPIC_API_KEY is not configured", "anthropic", undefined, false);
  }

  const client = getAnthropicClient();
  const model = request.model ?? DEFAULT_MODELS.anthropic;

  // Separate system message from user/assistant messages
  const systemMsg = request.messages.find((m) => m.role === "system");
  const chatMessages = request.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const msg = await client.messages.create({
    model,
    max_tokens: request.maxTokens ?? 1024,
    temperature: request.temperature ?? 0.8,
    system: systemMsg?.content,
    messages: chatMessages,
  });

  const textContent = msg.content[0]?.type === "text" ? msg.content[0].text : "";

  return {
    textContent,
    model: msg.model,
    provider: "anthropic",
    usage: msg.usage
      ? {
          promptTokens: msg.usage.input_tokens,
          completionTokens: msg.usage.output_tokens,
          totalTokens: msg.usage.input_tokens + msg.usage.output_tokens,
        }
      : undefined,
  };
}

// ── Provider dispatch ───────────────────────────────────────────

async function callProvider(provider: LLMProviderId, request: LLMRequest): Promise<LLMResponse> {
  switch (provider) {
    case "openai":
      return callOpenAI(request);
    case "anthropic":
      return callAnthropic(request);
    default:
      throw new LLMError(`Unknown provider: ${provider}`, provider, undefined, false);
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof LLMError) return error.retryable;
  const status = (error as any)?.status ?? (error as any)?.statusCode;
  return status === 429 || (status >= 500 && status < 600);
}

// ── Public API ──────────────────────────────────────────────────

export interface GenerationStrategy {
  primary?: LLMProviderId;
  fallback?: LLMProviderId;
}

/**
 * Generate text via LLM with optional primary/fallback strategy.
 * Retries 3 times with 2s delay for retryable errors.
 */
export async function generateText(
  request: LLMRequest,
  strategy: GenerationStrategy = {},
): Promise<LLMResponse> {
  const primary = strategy.primary ?? "anthropic";
  const fallback = strategy.fallback;

  try {
    return await withRetry(() => callProvider(primary, request), {
      maxAttempts: 3,
      baseDelayMs: 2000,
      retryOn: isRetryableError,
    });
  } catch (primaryError) {
    // If we have a fallback and the primary error is retryable, try fallback
    if (fallback && isRetryableError(primaryError)) {
      try {
        return await withRetry(() => callProvider(fallback, request), {
          maxAttempts: 2,
          baseDelayMs: 2000,
          retryOn: isRetryableError,
        });
      } catch (fallbackError) {
        throw new LLMError(
          `Both providers failed. Primary (${primary}): ${(primaryError as Error).message}. Fallback (${fallback}): ${(fallbackError as Error).message}`,
          primary,
          undefined,
          false,
        );
      }
    }

    // Non-retryable or no fallback — rethrow
    throw primaryError;
  }
}
