/**
 * Tests for withRetry utility (S2.1 — Retry with exponential backoff + jitter)
 *
 * These tests assume the interface defined in IMPLEMENTATION_PLAN.md:
 *   withRetry<T>(fn, options?: RetryOptions): Promise<T>
 *
 *   RetryOptions {
 *     maxAttempts?: number;
 *     baseDelayMs?: number;
 *     maxDelayMs?: number;
 *     jitter?: boolean;
 *     retryOn?: (error: Error) => boolean;
 *   }
 *
 *   Default retryOn: retry on status 429, 5xx, or errors containing "timeout"/"rate limit"
 */

import { describe, expect, it, vi } from "vitest";
import { withRetry } from "../retry";

describe("withRetry", () => {
  it("retries on failure and succeeds on subsequent attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockResolvedValueOnce("success");

    const result = await withRetry(fn, { maxAttempts: 2, baseDelayMs: 10 });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries multiple times before succeeding", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockResolvedValueOnce("final");

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });

    expect(result).toBe("final");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after max attempts are exhausted", async () => {
    // Use an error that matches the default retryOn condition (contains "timeout")
    const fn = vi.fn().mockRejectedValue(new Error("request timeout"));

    await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 10 })).rejects.toThrow(
      "request timeout",
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry on non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Bad Request"));

    const retryOn = () => false;
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, retryOn })).rejects.toThrow(
      "Bad Request",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects custom retryOn function", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Custom transient error"))
      .mockRejectedValueOnce(new Error("Another transient error"))
      .mockResolvedValueOnce("custom-success");

    // Only retry on errors containing "transient"
    const retryOn = (error: Error) => error.message.includes("transient");

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, retryOn });

    expect(result).toBe("custom-success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops retrying when retryOn returns false after some retries", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient error"))
      .mockRejectedValueOnce(new Error("fatal error"));

    const retryOn = (error: Error) => error.message.includes("transient");

    // Second attempt throws "fatal error" which is NOT retryable
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, retryOn })).rejects.toThrow(
      "fatal error",
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("uses default retryOn for 429 status errors", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("Too Many Requests"), { status: 429 }));

    // Default retryOn should retry on 429 twice (3 attempts total) then throw
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })).rejects.toThrow(
      "Too Many Requests",
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("uses default retryOn for 5xx status errors", async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error("Server Error"), { status: 502 }));

    await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 10 })).rejects.toThrow(
      "Server Error",
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 4xx errors by default", async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error("Bad Request"), { status: 400 }));

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })).rejects.toThrow("Bad Request");
    // Default retryOn: 400 is not 429 and not 5xx — should not retry
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("handles non-Error thrown values by wrapping them", async () => {
    // Provide a custom retryOn that retries on everything since non-Error values
    // are wrapped in Error and won't match the default retryOn
    const retryOn = () => true;
    const fn = vi.fn().mockRejectedValue("string error");

    await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 10, retryOn })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("applies increasing delay between retries", async () => {
    // Use mockRejectedValueOnce to chain failures then a final success
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockResolvedValueOnce("success");

    const start = Date.now();
    await withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000, jitter: false });
    const elapsed = Date.now() - start;

    // Without jitter: delay = 100ms (attempt 1->2) + 200ms (attempt 2->3) = ~300ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(200);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("succeeds on first attempt without retry", async () => {
    const fn = vi.fn().mockResolvedValue("instant");

    const result = await withRetry(fn);

    expect(result).toBe("instant");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses default maxAttempts of 3", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("rate limit exceeded"));

    await expect(withRetry(fn, { baseDelayMs: 10 })).rejects.toThrow("rate limit exceeded");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not exceed maxDelayMs", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockRejectedValueOnce(new Error("rate limit"))
      // Persistent fallback in case all Once values are consumed
      .mockRejectedValue(new Error("rate limit"));

    const start = Date.now();
    await expect(
      withRetry(fn, { maxAttempts: 5, baseDelayMs: 10000, maxDelayMs: 50, jitter: false }),
    ).rejects.toThrow("rate limit");
    const elapsed = Date.now() - start;

    // Even though baseDelayMs is 10000, each delay is capped at maxDelayMs=50
    // Total: 50 + 50 + 50 + 50 = ~200ms
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });
});
