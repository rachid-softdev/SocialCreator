/**
 * LLM Provider Abstraction — Provider
 * Primary: Anthropic (default) or OpenAI (based on strategy)
 * Fallback: If primary fails with a retryable error, try the fallback
 *
 * Features:
 * - Retry-After header from 429 responses is honoured as the retry delay
 * - In-memory circuit breaker prevents hammering a failing provider
 */

import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "@/lib/utils/retry";
import {
  allowRequest,
  recordFailure as cbRecordFailure,
  recordSuccess as cbRecordSuccess,
} from "./circuitBreaker";
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

// ── Retry-After header parser ───────────────────────────────────

/**
 * Parse a Retry-After header value.
 * Supports both:
 *  - seconds as integer (e.g. "120")
 *  - HTTP-date format   (e.g. "Wed, 21 Oct 2015 07:28:00 GMT")
 * Returns the delay in milliseconds, or undefined if unparseable.
 */
function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;

  // Try seconds-as-integer first
  const seconds = parseInt(headerValue, 10);
  if (!isNaN(seconds) && seconds >= 0 && String(seconds) === headerValue.trim()) {
    return seconds * 1000;
  }

  // Try HTTP-date format
  const date = new Date(headerValue);
  if (!isNaN(date.getTime())) {
    const delay = date.getTime() - Date.now();
    return Math.max(delay, 1000); // at least 1 second
  }

  return undefined;
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

    // Parse Retry-After header for 429 responses
    let retryAfterMs: number | undefined;
    if (status === 429) {
      retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
    }

    throw new LLMError(
      `OpenAI API error (${status}): ${body}`,
      "openai",
      status,
      retryable,
      retryAfterMs,
    );
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

// ── Circuit breaker helpers ─────────────────────────────────────

/**
 * Returns true when the error represents the synthetic "circuit is open" case
 * so we can distinguish it from real provider errors.
 */
function isCircuitOpenError(error: unknown): boolean {
  return (error as Error)?.message?.includes("circuit is open");
}

// ── Public API ──────────────────────────────────────────────────

export interface GenerationStrategy {
  primary?: LLMProviderId;
  fallback?: LLMProviderId;
}

/**
 * Generate text via LLM with optional primary/fallback strategy.
 *
 * Features:
 *  - Retries up to 3 times (primary) / 2 times (fallback) with backoff
 *  - Respects Retry-After headers from 429 responses
 *  - Circuit breaker protects against hammering a failing provider
 */
export async function generateText(
  request: LLMRequest,
  strategy: GenerationStrategy = {},
): Promise<LLMResponse> {
  const primary = strategy.primary ?? "anthropic";
  const fallback = strategy.fallback;

  // ── Attempt primary ─────────────────────────────────────────
  try {
    // Circuit breaker: reject early if the provider is known to be down
    if (!allowRequest(primary)) {
      throw new LLMError(`Provider ${primary} circuit is open`, primary, undefined, true);
    }

    const result = await withRetry(() => callProvider(primary, request), {
      maxAttempts: 3,
      baseDelayMs: 2000,
      retryOn: isRetryableError,
    });
    cbRecordSuccess(primary);
    return result;
  } catch (primaryError) {
    // Record circuit failure only for real provider errors, not circuit-open signals
    if (isRetryableError(primaryError) && !isCircuitOpenError(primaryError)) {
      cbRecordFailure(primary);
    }

    // Try fallback if the primary error is retryable and a fallback is configured
    if (fallback && isRetryableError(primaryError)) {
      return callFallback(fallback, request, primary, primaryError as Error);
    }

    // Non-retryable error or no fallback — rethrow
    throw primaryError;
  }
}

/**
 * Attempt the fallback provider.
 * Also checks the circuit breaker before making the call.
 */
async function callFallback(
  fallback: LLMProviderId,
  request: LLMRequest,
  primary: LLMProviderId,
  primaryError: Error,
): Promise<LLMResponse> {
  try {
    if (!allowRequest(fallback)) {
      throw new LLMError(`Provider ${fallback} circuit is open`, fallback, undefined, false);
    }

    const result = await withRetry(() => callProvider(fallback, request), {
      maxAttempts: 2,
      baseDelayMs: 2000,
      retryOn: isRetryableError,
    });
    cbRecordSuccess(fallback);
    return result;
  } catch (fallbackError) {
    if (isRetryableError(fallbackError) && !isCircuitOpenError(fallbackError)) {
      cbRecordFailure(fallback);
    }

    throw new LLMError(
      `Both providers failed. Primary (${primary}): ${primaryError.message}. Fallback (${fallback}): ${(fallbackError as Error).message}`,
      primary,
      undefined,
      false,
    );
  }
}
