import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishToYouTube } from "../../publishers/youtube";

// Mock fetchWithTimeout
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

describe("publishToYouTube", () => {
  const mockContent = {
    textContent: "Test video",
    mediaUrls: ["https://storage.example.com/video.mp4"],
    hashtags: ["test", "video"],
  };
  const mockAccount = {
    accountId: "channel123",
    accessToken: "ya29.valid-token",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── Existing tests: media required ───────────────────────────────────

  describe("media required", () => {
    it("should return error if no media URLs provided", async () => {
      const result = await publishToYouTube({ ...mockContent, mediaUrls: [] }, mockAccount);
      expect(result.success).toBe(false);
      expect(result.error).toContain("requires video content");
    });
  });

  // ── Existing tests: SSRF validation ──────────────────────────────────

  describe("SSRF validation", () => {
    /**
     * publishToYouTube first calls fetchWithTimeout to initiate a YouTube upload,
     * then validates the media URL. We need the init call to succeed so the
     * SSRF validation step is reached.
     */
    function mockSuccessfulInitiation(): void {
      const mockHeaders = new Map<string, string>([
        ["Location", "https://youtube.com/upload/session/abc123"],
      ]);
      vi.mocked(fetchWithTimeout).mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => mockHeaders.get(name) ?? null,
        },
        json: vi.fn().mockResolvedValue({}),
      } as unknown as Response);
    }

    it("should return error for SSRF attempt with non-HTTPS URL", async () => {
      mockSuccessfulInitiation();
      const result = await publishToYouTube(
        {
          ...mockContent,
          mediaUrls: ["http://169.254.169.254/latest/meta-data/"],
        },
        mockAccount,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid video URL");
    });

    it("should return error for private IP URL", async () => {
      mockSuccessfulInitiation();
      const result = await publishToYouTube(
        { ...mockContent, mediaUrls: ["https://192.168.1.1/video.mp4"] },
        mockAccount,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid video URL");
    });
  });

  // ── New tests: success flow ──────────────────────────────────────────

  describe("success", () => {
    function mockFullUploadFlow(videoId = "yt_123"): void {
      const mockFetch = vi.mocked(fetchWithTimeout);
      // Step 1: Init → returns Location header
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          headers: { Location: "https://youtube.com/upload/abc123" },
          json: {},
        }),
      );
      // Step 2: Fetch video blob
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ ok: true, blob: new Blob(["fake video content"]) }),
      );
      // Step 3: Upload to YouTube → returns video id
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true, json: { id: videoId } }));
    }

    it("should upload successfully with full 3-step flow", async () => {
      mockFullUploadFlow("yt_success_123");

      const result = await publishToYouTube(mockContent, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("yt_success_123");
      expect(result.postUrl).toBe("https://youtu.be/yt_success_123");
      expect(fetchWithTimeout).toHaveBeenCalledTimes(3);
    });

    it("should include correct headers in init request", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            headers: { Location: "https://youtube.com/upload/abc123" },
            json: {},
          }),
        )
        .mockResolvedValueOnce(createMockResponse({ ok: true, blob: new Blob() }))
        .mockResolvedValueOnce(createMockResponse({ ok: true, json: { id: "yt_123" } }));

      await publishToYouTube(mockContent, mockAccount);

      const initCall = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = initCall.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer ya29.valid-token");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["X-Upload-Content-Length"]).toBe("0");
      expect(headers["X-Upload-Content-Type"]).toBe("video/mp4");
    });

    it("should include snippet with title, description, and tags", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            headers: { Location: "https://youtube.com/upload/abc123" },
            json: {},
          }),
        )
        .mockResolvedValueOnce(createMockResponse({ ok: true, blob: new Blob() }))
        .mockResolvedValueOnce(createMockResponse({ ok: true, json: { id: "yt_123" } }));

      await publishToYouTube(mockContent, mockAccount);

      const initBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(initBody.snippet.title).toBe("Test video");
      expect(initBody.snippet.description).toContain("#test #video");
      expect(initBody.snippet.tags).toEqual(["test", "video"]);
      expect(initBody.snippet.categoryId).toBe("22");
      expect(initBody.status.privacyStatus).toBe("public");
    });
  });

  // ── New tests: error handling ────────────────────────────────────────

  describe("error handling", () => {
    it("should return error when upload initiation fails", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 401,
          json: { error: { message: "Invalid credentials" } },
        }),
      );

      const result = await publishToYouTube(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("YouTube API error: 401");
    });

    it("should fall back to status text when init response has no error message", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      // Status 400 so error message doesn't trigger shouldRetry (500/503/network/ETIMEDOUT)
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 400,
          json: {},
        }),
      );

      const result = await publishToYouTube(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("YouTube API error: 400");
    });

    it("should return error when no Location header returned", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          headers: {},
          json: {},
        }),
      );

      const result = await publishToYouTube(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No upload URL returned from YouTube");
    });

    it("should return error when video fetch fails", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            headers: { Location: "https://youtube.com/upload/abc123" },
            json: {},
          }),
        )
        .mockResolvedValueOnce(createMockResponse({ ok: false, status: 404 }));

      const result = await publishToYouTube(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to fetch video: 404");
    });

    it("should return error when upload to YouTube fails", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            headers: { Location: "https://youtube.com/upload/abc123" },
            json: {},
          }),
        )
        .mockResolvedValueOnce(createMockResponse({ ok: true, blob: new Blob() }))
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 502,
            json: { error: { message: "Upload failed - bad gateway" } },
          }),
        );

      const result = await publishToYouTube(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("YouTube upload error: 502");
    });

    it("should fall back to status text when upload error has no message", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      // Status 400 so error message doesn't trigger shouldRetry (500/503/network/ETIMEDOUT)
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            headers: { Location: "https://youtube.com/upload/abc123" },
            json: {},
          }),
        )
        .mockResolvedValueOnce(createMockResponse({ ok: true, blob: new Blob() }))
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 400,
            json: {},
          }),
        );

      const result = await publishToYouTube(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("YouTube upload error: 400");
    });

    it("should return error on network failure", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const result = await publishToYouTube(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network failure");
    });

    it("should return generic error for non-Error thrown values", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValueOnce("String error");

      const result = await publishToYouTube(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown YouTube upload error");
    });
  });

  // ── New tests: retry logic ───────────────────────────────────────────

  describe("retry logic", () => {
    it("should retry on transient init error and recover", async () => {
      vi.useFakeTimers();
      const mockFetch = vi.mocked(fetchWithTimeout);
      // Attempt 1: init fails with 500
      mockFetch
        .mockRejectedValueOnce(new Error("500 Internal Server Error"))
        // Attempt 2: init succeeds
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            headers: { Location: "https://youtube.com/upload/retry123" },
            json: {},
          }),
        )
        // Attempt 2: video fetch succeeds
        .mockResolvedValueOnce(createMockResponse({ ok: true, blob: new Blob() }))
        // Attempt 2: upload succeeds
        .mockResolvedValueOnce(createMockResponse({ ok: true, json: { id: "yt_retry_123" } }));

      const promise = publishToYouTube(mockContent, mockAccount);

      // baseDelay * attempt = 2000 * 1 = 2000
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.postId).toBe("yt_retry_123");
      expect(mockFetch).toHaveBeenCalledTimes(4);

      vi.useRealTimers();
    });

    it("should exhaust all retries and return failure", async () => {
      vi.useFakeTimers();
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValue(new Error("503 Service Unavailable"));

      const promise = publishToYouTube(mockContent, mockAccount);

      // Attempt 1: fails → delay 2000
      // Attempt 2: fails → delay 4000
      // Attempt 3: fails → no retry (attempt === maxRetries)
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain("503");
      expect(mockFetch).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it("should not retry on non-transient errors", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 400,
          json: { error: { message: "Bad request" } },
        }),
      );

      const result = await publishToYouTube(mockContent, mockAccount);

      expect(result.success).toBe(false);
      // Should only have been called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ── New tests: edge cases ────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle empty textContent", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            headers: { Location: "https://youtube.com/upload/abc123" },
            json: {},
          }),
        )
        .mockResolvedValueOnce(createMockResponse({ ok: true, blob: new Blob() }))
        .mockResolvedValueOnce(createMockResponse({ ok: true, json: { id: "yt_empty_123" } }));

      const result = await publishToYouTube({ ...mockContent, textContent: "" }, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("yt_empty_123");

      // Should use default title "Untitled Video"
      const initBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(initBody.snippet.title).toBe("Untitled Video");
    });

    it("should handle missing access token", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 401,
          json: { error: { message: "Invalid credentials" } },
        }),
      );

      const result = await publishToYouTube(mockContent, { ...mockAccount, accessToken: "" });

      expect(result.success).toBe(false);
    });

    it("should handle unexpected upload response shape (no id)", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            headers: { Location: "https://youtube.com/upload/abc123" },
            json: {},
          }),
        )
        .mockResolvedValueOnce(createMockResponse({ ok: true, blob: new Blob() }))
        .mockResolvedValueOnce(createMockResponse({ ok: true, json: { status: "processing" } }));

      const result = await publishToYouTube(mockContent, mockAccount);

      // The function passes through the API response as-is.
      // If the response has no id, the upload technically succeeded
      // but we return success with postId = undefined
      expect(result.success).toBe(true);
      expect(result.postId).toBeUndefined();
    });
  });
});
