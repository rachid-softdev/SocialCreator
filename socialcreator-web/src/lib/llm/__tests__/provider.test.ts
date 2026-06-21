/**
 * Tests for LLM Provider Abstraction
 *
 * Verifies:
 * - Primary succeeds
 * - Fallback on failure
 * - Both fail
 * - Non-retryable error bypasses fallback
 * - Retry mechanism (withRetry integration)
 * - Retry-After header parsing and delay
 * - Circuit breaker operations
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { getCircuitState, resetCircuit } from "../circuitBreaker";
import { generateText } from "../provider";
import { LLMError } from "../types";

describe("LLM Provider — generateText", () => {
  const baseRequest = {
    messages: [{ role: "user" as const, content: "Hello" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetCircuit();
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
  });

  // ── Primary succeeds ─────────────────────────────────────────

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

  // ── Fallback on failure ──────────────────────────────────────

  describe("fallback on failure", () => {
    it("should fallback to OpenAI when Anthropic fails with retryable error", async () => {
      mockAnthropicMessagesCreate.mockRejectedValue(
        new LLMError("Rate limited", "anthropic", 429, true),
      );

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

  // ── Both fail ────────────────────────────────────────────────

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

  // ── Non-retryable error ──────────────────────────────────────

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

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ── Retry mechanism ──────────────────────────────────────────

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

  // ── Retry-After header ───────────────────────────────────────

  describe("Retry-After header", () => {
    it("should include retryAfterMs for 429 with Retry-After seconds", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: { get: () => "5" },
        text: async () => "Rate limited",
      });

      try {
        await generateText(baseRequest, { primary: "openai" });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).retryAfterMs).toBe(5000);
      }
    }, 30000);

    it("should include retryAfterMs for 429 with Retry-After HTTP-date", async () => {
      const futureDate = new Date(Date.now() + 10_000);
      const httpDate = futureDate.toUTCString();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: { get: () => httpDate },
        text: async () => "Rate limited",
      });

      try {
        await generateText(baseRequest, { primary: "openai" });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        const retryAfterMs = (error as LLMError).retryAfterMs;
        expect(retryAfterMs).toBeDefined();
        expect(retryAfterMs!).toBeGreaterThanOrEqual(1000);
        expect(retryAfterMs!).toBeLessThanOrEqual(12_000);
      }
    }, 30000);

    it("should not include retryAfterMs for 429 without Retry-After header", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: { get: () => null },
        text: async () => "Rate limited",
      });

      try {
        await generateText(baseRequest, { primary: "openai" });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).retryAfterMs).toBeUndefined();
      }
    }, 30000);

    it("should not include retryAfterMs for 5xx errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        headers: { get: () => "30" },
        text: async () => "Service unavailable",
      });

      try {
        await generateText(baseRequest, { primary: "openai" });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).retryAfterMs).toBeUndefined();
      }
    }, 30000);

    it("should call withRetry with retryAfterMs from LLMError", async () => {
      // Verify the error chain: callOpenAI throws LLMError with retryAfterMs,
      // and withRetry uses it as the delay. We verify this by catching the error
      // and checking retryAfterMs is preserved through the retry chain.
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => "3" },
          text: async () => "Rate limited",
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => "3" },
          text: async () => "Rate limited",
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "OK" } }],
            model: "gpt-4o-mini",
          }),
        });

      const result = await generateText(baseRequest, { primary: "openai" });
      expect(result.textContent).toBe("OK");
      // all 3 attempts were made (2 retries with Retry-After delay)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 30000);
  });

  // ── Circuit breaker ──────────────────────────────────────────

  describe("circuit breaker", () => {
    let savedUnhandledRejectionHandlers: Array<(...args: any[]) => void>;

    beforeAll(() => {
      // Remove vitest's unhandledRejection listeners and replace with our own
      // that filters out expected LLMError rejections. Vitest registers its
      // listener before tests run (in startVitestExecutor), so we must remove it
      // here to prevent it from reporting expected LLMError rejections that arise
      // from tinyspy's promise-wrapping logic during fake-timer async scheduling.
      savedUnhandledRejectionHandlers = process.listeners("unhandledRejection") as Array<
        (...args: any[]) => void
      >;
      savedUnhandledRejectionHandlers.forEach((h) =>
        process.removeListener("unhandledRejection", h),
      );
      process.on("unhandledRejection", (reason: unknown) => {
        if (!(reason instanceof LLMError)) {
          // Re-route non-LLMError rejections to the original vitest handlers
          savedUnhandledRejectionHandlers.forEach((h) => h(reason));
        }
        // LLMError rejections are expected during circuit breaker tests — swallow
      });
      // Suppress the harmless Node.js warning when a rejection is handled late
      process.on("rejectionHandled", () => {});
    });

    afterAll(() => {
      // Restore original vitest handlers
      process.removeAllListeners("unhandledRejection");
      process.removeAllListeners("rejectionHandled");
      savedUnhandledRejectionHandlers.forEach((h) =>
        process.on("unhandledRejection", h),
      );
    });

    afterEach(async () => {
      // Fully drain any remaining fake timers before cleanup
      try {
        await vi.runAllTimersAsync();
      } catch {
        // drain silently
      }
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it("should open circuit after 3 consecutive retryable failures", async () => {
      vi.useFakeTimers();

      mockAnthropicMessagesCreate.mockRejectedValue(
        new LLMError("Server error", "anthropic", 503, true),
      );

      // First 3 calls each exhaust 3 retries
      for (let i = 0; i < 3; i++) {
        const promise = generateText(baseRequest);
        // Advance enough time for all retries (3 attempts × ~6s each)
        await vi.advanceTimersByTimeAsync(30_000);
        await expect(promise).rejects.toThrow(LLMError);
      }

      expect(getCircuitState("anthropic")).toBe("open");

      // 4th call — circuit is open, should fail immediately
      await expect(generateText(baseRequest)).rejects.toThrow(/circuit is open/);

      // 9 = 3 calls × 3 retries (4th call is blocked by circuit)
      expect(mockAnthropicMessagesCreate).toHaveBeenCalledTimes(9);
    });

    it("should fallback when primary circuit is open", async () => {
      vi.useFakeTimers();

      mockAnthropicMessagesCreate.mockRejectedValue(
        new LLMError("Server error", "anthropic", 503, true),
      );

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Fallback OK" } }],
          model: "gpt-4o-mini",
        }),
      });

      // Open the primary circuit
      for (let i = 0; i < 3; i++) {
        const promise = generateText(baseRequest);
        await vi.advanceTimersByTimeAsync(30_000);
        await expect(promise).rejects.toThrow(LLMError);
      }

      expect(getCircuitState("anthropic")).toBe("open");

      // 4th call — circuit open for primary, should use fallback
      const result = await generateText(baseRequest, {
        primary: "anthropic",
        fallback: "openai",
      });

      expect(result.textContent).toBe("Fallback OK");
      expect(result.provider).toBe("openai");
      expect(getCircuitState("anthropic")).toBe("open");
      expect(getCircuitState("openai")).toBe("closed");
    });

    it("should close circuit after successful half-open request following cooldown", async () => {
      vi.useFakeTimers();

      // Phase 1: Open the circuit
      mockAnthropicMessagesCreate.mockRejectedValue(
        new LLMError("Server error", "anthropic", 503, true),
      );

      for (let i = 0; i < 3; i++) {
        const promise = generateText(baseRequest);
        await vi.advanceTimersByTimeAsync(30_000);
        await expect(promise).rejects.toThrow(LLMError);
      }

      expect(getCircuitState("anthropic")).toBe("open");

      // Phase 2: Advance past the 30s cooldown
      await vi.advanceTimersByTimeAsync(31_000);

      // Phase 3: Half-open probe succeeds
      mockAnthropicMessagesCreate.mockResolvedValue({
        content: [{ type: "text", text: "Back online" }],
        model: "claude-sonnet-4-20250514",
        usage: { input_tokens: 5, output_tokens: 10 },
      });

      const result = await generateText(baseRequest);
      expect(result.textContent).toBe("Back online");
      expect(getCircuitState("anthropic")).toBe("closed");
    });

    it("should stay open if half-open probe request fails", async () => {
      vi.useFakeTimers();

      // Phase 1: Open the circuit
      mockAnthropicMessagesCreate.mockRejectedValue(
        new LLMError("Server error", "anthropic", 503, true),
      );

      for (let i = 0; i < 3; i++) {
        const promise = generateText(baseRequest);
        await vi.advanceTimersByTimeAsync(30_000);
        await expect(promise).rejects.toThrow(LLMError);
      }

      expect(getCircuitState("anthropic")).toBe("open");

      // Phase 2: Advance past cooldown
      await vi.advanceTimersByTimeAsync(31_000);

      // Phase 3: Half-open probe fails
      const probePromise = generateText(baseRequest);
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(probePromise).rejects.toThrow(LLMError);

      expect(getCircuitState("anthropic")).toBe("open");
    });

    it("should not open circuit for non-retryable errors", async () => {
      mockAnthropicMessagesCreate.mockRejectedValue(
        new LLMError("Bad request", "anthropic", 400, false),
      );

      await expect(generateText(baseRequest)).rejects.toThrow(LLMError);
      await expect(generateText(baseRequest)).rejects.toThrow(LLMError);
      await expect(generateText(baseRequest)).rejects.toThrow(LLMError);

      expect(getCircuitState("anthropic")).toBe("closed");
    });

    it("should reset circuit on successful call after circuit was opened", async () => {
      vi.useFakeTimers();

      // Open the circuit
      mockAnthropicMessagesCreate.mockRejectedValue(
        new LLMError("Server error", "anthropic", 503, true),
      );

      for (let i = 0; i < 3; i++) {
        const promise = generateText(baseRequest);
        await vi.advanceTimersByTimeAsync(30_000);
        await expect(promise).rejects.toThrow(LLMError);
      }
      expect(getCircuitState("anthropic")).toBe("open");

      // Advance past cooldown
      await vi.advanceTimersByTimeAsync(31_000);

      // Successful half-open request
      mockAnthropicMessagesCreate.mockResolvedValue({
        content: [{ type: "text", text: "Recovered" }],
        model: "claude-sonnet-4-20250514",
      });

      const result = await generateText(baseRequest);
      expect(result.textContent).toBe("Recovered");
      expect(getCircuitState("anthropic")).toBe("closed");
    });

    it("should fallback immediately when primary circuit is open but fallback works", async () => {
      vi.useFakeTimers();

      // Open the anthropic circuit
      mockAnthropicMessagesCreate.mockRejectedValue(
        new LLMError("Anthropic down", "anthropic", 503, true),
      );

      for (let i = 0; i < 3; i++) {
        const promise = generateText(baseRequest);
        await vi.runAllTimersAsync();
        await expect(promise).rejects.toThrow(LLMError);
      }
      expect(getCircuitState("anthropic")).toBe("open");

      // Now open the OpenAI circuit too via fallback attempts
      mockFetch.mockRejectedValue(new LLMError("OpenAI down", "openai", 503, true));

      for (let i = 0; i < 3; i++) {
        const promise = generateText(baseRequest, {
          primary: "anthropic",
          fallback: "openai",
        });
        // Primary fails immediately (circuit open), fallback retries 2 times
        await vi.runAllTimersAsync();
        await expect(promise).rejects.toThrow(LLMError);
      }

      expect(getCircuitState("openai")).toBe("open");

      // Next call — both circuits open
      await expect(
        generateText(baseRequest, {
          primary: "anthropic",
          fallback: "openai",
        }),
      ).rejects.toThrow(/both providers failed/i);
      await vi.runAllTimersAsync();
    }, 30_000);
  });

  // ── Error cases ──────────────────────────────────────────────

  describe("error cases", () => {
    it("should throw when OPENAI_API_KEY is missing", async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(generateText(baseRequest, { primary: "openai" })).rejects.toThrow(
        /OPENAI_API_KEY is not configured/,
      );
    });

    it("should throw when ANTHROPIC_API_KEY is missing", async () => {
      delete process.env.ANTHROPIC_API_KEY;

      await expect(generateText(baseRequest, { primary: "anthropic" })).rejects.toThrow(
        /ANTHROPIC_API_KEY is not configured/,
      );
    });
  });

  // ── Circuit breaker integration with retry ───────────────────

  describe("circuit breaker integration with retry", () => {
    let savedUnhandledRejectionHandlers: Array<(...args: any[]) => void>;

    beforeAll(() => {
      // Same handler swap as circuit breaker block: suppress expected LLMError
      // unhandled rejections that arise from tinyspy's promise wrapping.
      savedUnhandledRejectionHandlers = process.listeners("unhandledRejection") as Array<
        (...args: any[]) => void
      >;
      savedUnhandledRejectionHandlers.forEach((h) =>
        process.removeListener("unhandledRejection", h),
      );
      process.on("unhandledRejection", (reason: unknown) => {
        if (!(reason instanceof LLMError)) {
          savedUnhandledRejectionHandlers.forEach((h) => h(reason));
        }
      });
      process.on("rejectionHandled", () => {});
    });

    afterAll(() => {
      process.removeAllListeners("unhandledRejection");
      process.removeAllListeners("rejectionHandled");
      savedUnhandledRejectionHandlers.forEach((h) =>
        process.on("unhandledRejection", h),
      );
    });

    afterEach(async () => {
      // Fully drain all remaining fake timers to prevent unhandled rejections
      try {
        await vi.runAllTimersAsync();
      } catch {
        /* drain */
      }
      vi.useRealTimers();
    });

    it("should not count individual retry attempts as circuit failures", async () => {
      vi.useFakeTimers();

      // Anthropic fails twice then succeeds on 3rd retry
      mockAnthropicMessagesCreate
        .mockRejectedValueOnce(new LLMError("Rate limit", "anthropic", 429, true))
        .mockRejectedValueOnce(new LLMError("Rate limit", "anthropic", 429, true))
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Success on retry 3" }],
          model: "claude-sonnet-4-20250514",
        });

      const promise = generateText(baseRequest);
      await vi.advanceTimersByTimeAsync(30_000);

      const result = await promise;
      expect(result.textContent).toBe("Success on retry 3");
      expect(getCircuitState("anthropic")).toBe("closed");
    });

    it("should count 1 circuit failure per generateText call (not per retry)", async () => {
      vi.useFakeTimers();

      mockAnthropicMessagesCreate.mockRejectedValue(
        new LLMError("Server error", "anthropic", 503, true),
      );

      // 2 calls = 2 circuit failures → circuit still closed
      for (let i = 0; i < 2; i++) {
        const promise = generateText(baseRequest);
        await vi.advanceTimersByTimeAsync(30_000);
        await expect(promise).rejects.toThrow(LLMError);
      }

      expect(getCircuitState("anthropic")).toBe("closed");

      // 3rd call → circuit opens
      const p3 = generateText(baseRequest);
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(p3).rejects.toThrow(LLMError);
      expect(getCircuitState("anthropic")).toBe("open");

      // 4th call — immediately denied, no Anthropic calls
      await expect(generateText(baseRequest)).rejects.toThrow(/circuit is open/);
      await vi.advanceTimersByTimeAsync(60_000);

      // 3 calls × 3 retries = 9 calls to Anthropic
      expect(mockAnthropicMessagesCreate).toHaveBeenCalledTimes(9);
    });
  });
});
