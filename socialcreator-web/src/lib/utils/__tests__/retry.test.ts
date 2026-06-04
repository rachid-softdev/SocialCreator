/**
 * Tests for withRetry utility (src/lib/utils/retry.ts)
 * Retry with exponential backoff + jitter
 */

import { describe, expect, it, vi } from "vitest";
import { withRetry } from "../retry";

describe("withRetry (utils)", () => {
  describe("nominal cases", () => {
    it("should succeed on first attempt without retry", async () => {
      const fn = vi.fn().mockResolvedValue("instant");
      const result = await withRetry(fn);
      expect(result).toBe("instant");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and succeed on subsequent attempt", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("rate limit"))
        .mockResolvedValueOnce("success");

      const result = await withRetry(fn, { maxAttempts: 2, baseDelayMs: 10 });
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should retry multiple times before succeeding", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("timeout"))
        .mockRejectedValueOnce(new Error("rate limit"))
        .mockResolvedValueOnce("final");

      const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });
      expect(result).toBe("final");
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe("error handling", () => {
    it("should throw after max attempts are exhausted", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("request timeout"));
      await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 10 })).rejects.toThrow(
        "request timeout",
      );
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should use default maxAttempts of 3", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("rate limit exceeded"));
      await expect(withRetry(fn, { baseDelayMs: 10 })).rejects.toThrow("rate limit exceeded");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should not retry on non-retryable errors", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Bad Request"));
      const retryOn = () => false;
      await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, retryOn })).rejects.toThrow(
        "Bad Request",
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should handle non-Error thrown values by wrapping them", async () => {
      const retryOn = () => true;
      const fn = vi.fn().mockRejectedValue("string error");
      await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 10, retryOn })).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should stop retrying when retryOn returns false mid-chain", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("transient error"))
        .mockRejectedValueOnce(new Error("fatal error"));

      const retryOn = (error: Error) => error.message.includes("transient");
      await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, retryOn })).rejects.toThrow(
        "fatal error",
      );
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should propagate non-retryable 4xx errors immediately (default retryOn)", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("Bad Request"), { status: 400 }));
      await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })).rejects.toThrow(
        "Bad Request",
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("retryOn behaviour", () => {
    it("should retry on 429 status errors by default", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("Too Many Requests"), { status: 429 }));

      await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })).rejects.toThrow(
        "Too Many Requests",
      );
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should retry on 5xx status errors by default", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("Server Error"), { status: 502 }));
      await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 10 })).rejects.toThrow(
        "Server Error",
      );
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should retry on errors containing 'timeout' by default", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("connection timeout"))
        .mockResolvedValueOnce("ok");
      const result = await withRetry(fn, { maxAttempts: 2, baseDelayMs: 10 });
      expect(result).toBe("ok");
    });

    it("should respect custom retryOn function", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Custom transient error"))
        .mockRejectedValueOnce(new Error("Another transient error"))
        .mockResolvedValueOnce("custom-success");

      const retryOn = (error: Error) => error.message.includes("transient");
      const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, retryOn });
      expect(result).toBe("custom-success");
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe("backoff and timing", () => {
    it("should apply increasing delay between retries", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("rate limit"))
        .mockRejectedValueOnce(new Error("rate limit"))
        .mockResolvedValueOnce("success");

      const start = Date.now();
      await withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000, jitter: false });
      const elapsed = Date.now() - start;

      // Without jitter: ~100ms (attempt 1->2) + ~200ms (attempt 2->3) >= ~200ms
      expect(elapsed).toBeGreaterThanOrEqual(150);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should not exceed maxDelayMs", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("rate limit"))
        .mockRejectedValueOnce(new Error("rate limit"))
        .mockRejectedValueOnce(new Error("rate limit"))
        .mockRejectedValue(new Error("rate limit"));

      const start = Date.now();
      await expect(
        withRetry(fn, { maxAttempts: 5, baseDelayMs: 10000, maxDelayMs: 50, jitter: false }),
      ).rejects.toThrow("rate limit");
      const elapsed = Date.now() - start;

      // Each delay capped at 50ms: ~200ms for 4 delays
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });
});
