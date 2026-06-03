/**
 * Tests for LLM Provider Abstraction
 *
 * Verifies:
 * - Primary succeeds
 * - Fallback on failure
 * - Both fail
 * - Non-retryable error bypasses fallback
 * - Retry mechanism
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks (must use vi.hoisted for hoisted code) ──────

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.stubGlobal("fetch", mockFetch);

const mockAnthropicMessagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => ({
    messages: {
      create: mockAnthropicMessagesCreate,
    },
  })),
}));

// ── Imports (after mocks) ──────────────────────────────────────

import { generateText } from "../provider";
import { LLMError } from "../types";

describe("LLM Provider — generateText", () => {
  const baseRequest = {
    messages: [{ role: "user" as const, content: "Hello" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure env vars are set (they are set in vitest.setup.ts but just in case)
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
  });

  describe("primary succeeds", () => {
    it("should call Anthropic by default and return response", async () => {
      mockAnthropicMessagesCreate.mockResolvedValue({
        content: [{ type: "text", text: "Hello from Claude" }],
        model: "claude-sonnet-4-20250514",
        usage: { input_tokens: 10, output_tokens: 20 },
      });

      const result = await generateText(baseRequest);

      expect(result.textContent).toBe("Hello from Claude");
      expect(result.provider).toBe("anthropic");
      expect(result.model).toBe("claude-sonnet-4-20250514");
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
      expect(mockAnthropicMessagesCreate).toHaveBeenCalledTimes(1);
    });

    it("should call OpenAI when primary is openai", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Hello from GPT" } }],
          model: "gpt-4o-mini",
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      });

      const result = await generateText(baseRequest, { primary: "openai" });

      expect(result.textContent).toBe("Hello from GPT");
      expect(result.provider).toBe("openai");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("fallback on failure", () => {
    it("should fallback to OpenAI when Anthropic fails with retryable error", async () => {
      // Primary (Anthropic): all 3 retries fail with retryable error
      mockAnthropicMessagesCreate.mockRejectedValue(
        new LLMError("Rate limited", "anthropic", 429, true),
      );

      // Fallback (OpenAI): succeeds on first try
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Fallback response" } }],
          model: "gpt-4o-mini",
        }),
      });

      const result = await generateText(baseRequest, {
        primary: "anthropic",
        fallback: "openai",
      });

      expect(result.textContent).toBe("Fallback response");
      expect(result.provider).toBe("openai");
      expect(mockAnthropicMessagesCreate).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();
    }, 30000);

    it("should fallback to Anthropic when OpenAI fails with retryable error", async () => {
      mockFetch.mockRejectedValue(new LLMError("Server error", "openai", 500, true));

      mockAnthropicMessagesCreate.mockResolvedValue({
        content: [{ type: "text", text: "Claude fallback" }],
        model: "claude-sonnet-4-20250514",
      });

      const result = await generateText(baseRequest, {
        primary: "openai",
        fallback: "anthropic",
      });

      expect(result.textContent).toBe("Claude fallback");
      expect(result.provider).toBe("anthropic");
    }, 30000);
  });

  describe("both fail", () => {
    it("should throw LLMError when both providers fail", async () => {
      mockAnthropicMessagesCreate.mockRejectedValue(
        new LLMError("Anthropic down", "anthropic", 503, true),
      );

      mockFetch.mockRejectedValue(new LLMError("OpenAI down", "openai", 503, true));

      await expect(
        generateText(baseRequest, {
          primary: "anthropic",
          fallback: "openai",
        }),
      ).rejects.toThrow(LLMError);

      expect(mockAnthropicMessagesCreate).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();
    }, 30000);
  });

  describe("non-retryable error", () => {
    it("should NOT fallback on non-retryable error (e.g., 400)", async () => {
      mockAnthropicMessagesCreate.mockRejectedValue(
        new LLMError("Bad request", "anthropic", 400, false),
      );

      await expect(
        generateText(baseRequest, {
          primary: "anthropic",
          fallback: "openai",
        }),
      ).rejects.toThrow(LLMError);

      // Should NOT have called fallback
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("retry mechanism", () => {
    it("should retry Anthropic up to 3 times on retryable error then succeed", async () => {
      mockAnthropicMessagesCreate
        .mockRejectedValueOnce(new LLMError("Rate limit", "anthropic", 429, true))
        .mockRejectedValueOnce(new LLMError("Rate limit", "anthropic", 429, true))
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Succeeded on 3rd try" }],
          model: "claude-sonnet-4-20250514",
        });

      const result = await generateText(baseRequest);

      expect(result.textContent).toBe("Succeeded on 3rd try");
      expect(mockAnthropicMessagesCreate).toHaveBeenCalledTimes(3);
    }, 30000);

    it("should fail after 3 retries if always retryable", async () => {
      mockAnthropicMessagesCreate.mockRejectedValue(
        new LLMError("Rate limit", "anthropic", 429, true),
      );

      await expect(generateText(baseRequest)).rejects.toThrow(LLMError);
      expect(mockAnthropicMessagesCreate).toHaveBeenCalledTimes(3);
    }, 30000);
  });

  describe("error cases", () => {
    it("should throw when OPENAI_API_KEY is missing", async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(generateText(baseRequest, { primary: "openai" })).rejects.toThrow(
        /OPENAI_API_KEY is not configured/,
      );
    });
  });
});
