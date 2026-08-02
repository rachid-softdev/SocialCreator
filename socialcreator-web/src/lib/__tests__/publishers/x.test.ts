import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishToX } from "../../publishers/x";

vi.mock("@/lib/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import logger from "@/lib/logger";

function createMockResponse(
  overrides: {
    ok?: boolean;
    status?: number;
    json?: unknown;
    headers?: Record<string, string>;
  } = {},
): Response {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    json: vi.fn().mockResolvedValue(overrides.json ?? {}),
    text: vi.fn().mockResolvedValue(""),
    blob: vi.fn(),
    headers: {
      get: vi.fn((name: string) => {
        const h = overrides.headers ?? {};
        return h[name] ?? null;
      }),
    },
  } as unknown as Response;
}

describe("publishToX", () => {
  const mockContent = {
    textContent: "Hello X!",
    mediaUrls: [] as string[],
    hashtags: ["x", "testing"],
  };
  const mockAccount = {
    accountId: "user_123",
    accessToken: "x-token",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("success", () => {
    it("should publish successfully", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { data: { id: "x_123" } },
        }),
      );

      const result = await publishToX(mockContent, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("x_123");
      expect(result.postUrl).toBe("https://twitter.com/i/status/x_123");
    });

    it("should build correct postUrl from returned id", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { data: { id: "1850000000000000000" } },
        }),
      );

      const result = await publishToX(mockContent, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postUrl).toContain("1850000000000000000");
    });
  });

  describe("error handling", () => {
    it("should return error with detail field", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          json: { detail: "Duplicate tweet content" },
        }),
      );

      const result = await publishToX(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Duplicate tweet content");
    });

    it("should return error with title field", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          json: {
            title: "Unauthorized",
            errors: [{ message: "Bad token" }],
          },
        }),
      );

      const result = await publishToX(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    it("should return error from errors array when no detail or title", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          json: { errors: [{ message: "Over capacity" }] },
        }),
      );

      const result = await publishToX(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Over capacity");
    });

    it("should fall back to generic X API error for unexpected error shape", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          json: { weird_field: "something broke" },
        }),
      );

      const result = await publishToX(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("X API error: 200");
    });

    it("should throw on unexpected success response without data.id", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { data: {} },
        }),
      );

      const result = await publishToX(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unexpected response format from X API");
    });

    it("should handle empty response JSON on success", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: {},
        }),
      );

      const result = await publishToX(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unexpected response format from X API");
    });

    it("should return error on network failure", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const result = await publishToX(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network failure");
    });

    it("should return generic error for non-Error thrown values", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValueOnce("String error");

      const result = await publishToX(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("character limit", () => {
    it("should truncate text content to 280 characters", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { data: { id: "x_123" } },
        }),
      );

      const longText = "a".repeat(300);
      await publishToX({ ...mockContent, textContent: longText }, mockAccount);

      const callArg = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(callArg.body as string);
      expect(body.text.length).toBe(280);
      expect(body.text).toBe("a".repeat(280));
    });

    it("should not truncate text under 280 characters", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { data: { id: "x_123" } },
        }),
      );

      const shortText = "Short tweet";
      await publishToX({ ...mockContent, textContent: shortText }, mockAccount);

      const callArg = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(callArg.body as string);
      expect(body.text).toBe("Short tweet");
    });
  });

  describe("media warning", () => {
    it("should log warning when mediaUrls is populated but send text-only", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { data: { id: "x_123" } },
        }),
      );

      const result = await publishToX(
        {
          ...mockContent,
          mediaUrls: ["https://example.com/image.jpg"],
        },
        mockAccount,
      );

      expect(result.success).toBe(true);
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.stringContaining("Media upload not supported"),
      );
      // Verify text-only tweet was sent (no media field in body)
      const callArg = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(callArg.body as string);
      expect(body.text).toBeDefined();
      expect(body.media).toBeUndefined();
    });
  });

  describe("request details", () => {
    it("should POST to the correct endpoint", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { data: { id: "x_123" } },
        }),
      );

      await publishToX(mockContent, mockAccount);

      const callUrl = mockFetch.mock.calls[0]![0];
      expect(callUrl).toBe("https://api.twitter.com/2/tweets");
    });

    it("should include Bearer token in Authorization header", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { data: { id: "x_123" } },
        }),
      );

      await publishToX(mockContent, mockAccount);

      const callArg = mockFetch.mock.calls[0]![1] as RequestInit;
      const headers = callArg.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer x-token");
    });
  });
});
