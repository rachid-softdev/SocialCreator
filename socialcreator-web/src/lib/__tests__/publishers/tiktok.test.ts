import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishToTikTok } from "../../publishers/tiktok";

vi.mock("@/lib/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { fetchWithTimeout } from "@/lib/fetch-timeout";

// Note: @/lib/validate-url is intentionally NOT mocked — validateMediaUrl is a
// pure function with no network calls, and SSRF tests depend on the real implementation.

function createMockResponse(
  overrides: {
    ok?: boolean;
    status?: number;
    json?: unknown;
    text?: string;
    blob?: Blob;
    headers?: Record<string, string>;
  } = {},
): Response {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    json: vi.fn().mockResolvedValue(overrides.json ?? {}),
    text: vi.fn().mockResolvedValue(overrides.text ?? ""),
    blob: vi.fn().mockResolvedValue(overrides.blob ?? new Blob(["mock"])),
    headers: {
      get: vi.fn((name: string) => {
        const h = overrides.headers ?? {};
        return h[name] ?? null;
      }),
    },
  } as unknown as Response;
}

describe("publishToTikTok", () => {
  const mockContent = {
    textContent: "Test TikTok",
    mediaUrls: ["https://storage.example.com/video.mp4"],
    hashtags: ["test"],
  };
  const mockAccount = {
    accountId: "acc123",
    accessToken: "tiktok-token",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── SSRF Validation (keep existing) ──────────────────────────────────

  describe("SSRF validation", () => {
    it("should return error for non-HTTPS media URL", async () => {
      const result = await publishToTikTok(
        { ...mockContent, mediaUrls: ["http://localhost:8080/video.mp4"] },
        mockAccount,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid video URL");
    });

    it("should return error for private IP media URL", async () => {
      const result = await publishToTikTok(
        { ...mockContent, mediaUrls: ["https://10.0.0.1/video.mp4"] },
        mockAccount,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid video URL");
    });

    it("should return error for localhost media URL", async () => {
      const result = await publishToTikTok(
        { ...mockContent, mediaUrls: ["https://localhost:3000/video.mp4"] },
        mockAccount,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid video URL");
    });
  });

  // ── Success paths ────────────────────────────────────────────────────

  describe("success", () => {
    it("should publish video post successfully with post_id", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { post_id: "tiktok_123" },
        }),
      );

      const result = await publishToTikTok(mockContent, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("tiktok_123");
      expect(result.postUrl).toBe("https://www.tiktok.com/@user/video/tiktok_123");
    });

    it("should handle upload_url path successfully with post_id", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            json: {
              upload_url: "https://tiktok.com/upload/abc",
              post_id: "tiktok_456",
            },
          }),
        )
        // Video fetch
        .mockResolvedValueOnce(createMockResponse({ ok: true, blob: new Blob(["fake video"]) }))
        // Upload to TikTok
        .mockResolvedValueOnce(createMockResponse({ ok: true }));

      const result = await publishToTikTok(mockContent, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("tiktok_456");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should handle upload_url path without post_id (pending)", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            json: { upload_url: "https://tiktok.com/upload/abc" },
          }),
        )
        .mockResolvedValueOnce(createMockResponse({ ok: true, blob: new Blob(["fake video"]) }))
        .mockResolvedValueOnce(createMockResponse({ ok: true }));

      const result = await publishToTikTok(mockContent, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("pending");
      expect(result.postUrl).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should publish text-only post successfully", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { post_id: "tiktok_text_789" },
        }),
      );

      const result = await publishToTikTok({ ...mockContent, mediaUrls: [] }, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("tiktok_text_789");

      // Should set post_mode to TEXT_ONLY
      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.post_mode).toBe("TEXT_ONLY");
    });

    it("should return pending when response has no post_id or upload_url", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { status: "queued" },
        }),
      );

      const result = await publishToTikTok(mockContent, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("pending");
      expect(result.postUrl).toBeUndefined();
    });
  });

  // ── Error code mapping ───────────────────────────────────────────────

  describe("error code mapping", () => {
    it("should map invalid_access_token error", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          json: {
            error: {
              code: "invalid_access_token",
              message: "Access token invalid",
            },
          },
        }),
      );

      const result = await publishToTikTok(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toContain("access token expired");
    });

    it("should map rate_limit error", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          json: {
            error: {
              code: "rate_limit",
              message: "Too many requests",
            },
          },
        }),
      );

      const result = await publishToTikTok(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Rate limit exceeded");
    });

    it("should map content_policy_violation error", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          json: {
            error: {
              code: "content_policy_violation",
              message: "Video violates guidelines",
            },
          },
        }),
      );

      const result = await publishToTikTok(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toContain("community guidelines");
    });

    it("should use default error message for unknown error codes", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          json: {
            error: {
              code: "unknown_error",
              message: "Something went wrong",
            },
          },
        }),
      );

      const result = await publishToTikTok(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("TikTok API error: 200");
    });

    it("should handle error on successful response with data.error", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: {
            error: {
              code: "invalid_access_token",
              message: "Token expired",
            },
          },
        }),
      );

      const result = await publishToTikTok(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toContain("access token expired");
    });
  });

  // ── Network errors ───────────────────────────────────────────────────

  describe("network errors", () => {
    it("should return error on network failure", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const result = await publishToTikTok(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network failure");
    });

    it("should return generic error for non-Error thrown values", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValueOnce("String error");

      const result = await publishToTikTok(mockContent, mockAccount);

      // retryWithBackoff converts non-Error to new Error(String(error))
      expect(result.success).toBe(false);
      expect(result.error).toBe("String error");
    });
  });

  // ── Retry logic ──────────────────────────────────────────────────────

  describe("retry logic", () => {
    it("should retry on transient error and recover", async () => {
      vi.useFakeTimers();
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValueOnce(new Error("500 Internal Server Error")).mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { post_id: "tiktok_retry_123" },
        }),
      );

      const promise = publishToTikTok(mockContent, mockAccount);

      // retryWithBackoff: baseDelay * 2^(attempt-1) = 2000 * 1 = 2000
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.postId).toBe("tiktok_retry_123");
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("should retry with exponential backoff delay", async () => {
      vi.useFakeTimers();
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockRejectedValueOnce(new Error("500 Server Error"))
        .mockRejectedValueOnce(new Error("500 Server Error"))
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            json: { post_id: "tiktok_retry_456" },
          }),
        );

      const promise = publishToTikTok(mockContent, mockAccount);

      // Attempt 1 → fails → delay 2000
      await vi.advanceTimersByTimeAsync(2000);
      // Attempt 2 → fails → delay 4000 (2000 * 2^1)
      await vi.advanceTimersByTimeAsync(4000);
      // Attempt 3 → succeeds

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.postId).toBe("tiktok_retry_456");
      expect(mockFetch).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it("should exhaust all retries and return failure", async () => {
      vi.useFakeTimers();
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValue(new Error("500 Server Error"));

      const promise = publishToTikTok(mockContent, mockAccount);

      // Attempt 1: fails → delay 2000
      // Attempt 2: fails → delay 4000
      // Attempt 3: fails → no retry (attempt === maxRetries)
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain("500");
      expect(mockFetch).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it("should not retry on non-transient 4xx error", async () => {
      vi.useFakeTimers();
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValueOnce(new Error("401 Unauthorized"));

      const promise = publishToTikTok(mockContent, mockAccount);

      // No timers to advance since non-transient errors don't schedule retries
      // Just let the promise settle
      await vi.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain("401");
      // Should only have been called once — no retry
      expect(mockFetch).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle empty textContent with video", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { post_id: "tiktok_empty_123" },
        }),
      );

      const result = await publishToTikTok({ ...mockContent, textContent: "" }, mockAccount);

      expect(result.success).toBe(true);
      // Should use default title "TikTok Post" for empty text
      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.title).toBe("TikTok Post");
    });

    it("should handle empty mediaUrls (text-only)", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { post_id: "tiktok_text_999" },
        }),
      );

      const result = await publishToTikTok({ ...mockContent, mediaUrls: [] }, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("tiktok_text_999");
    });

    it("should handle unexpected empty response shape", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: {},
        }),
      );

      const result = await publishToTikTok(mockContent, mockAccount);

      // Empty response with no post_id or upload_url → pending
      expect(result.success).toBe(true);
      expect(result.postId).toBe("pending");
    });

    it("should include hashtags in description", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { post_id: "tiktok_123" },
        }),
      );

      await publishToTikTok(mockContent, mockAccount);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.description).toContain("#test");
    });
  });
});
