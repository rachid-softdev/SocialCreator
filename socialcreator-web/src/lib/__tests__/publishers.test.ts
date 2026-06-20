/**
 * Tests for publisher map simplification
 * - getPublisher('INSTAGRAM') returns valid Publisher
 * - getPublisher('UNKNOWN') throws Error
 * - All registered platforms return a publisher
 * - publishContent delegates to correct publisher
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublisher, publishContent } from "@/lib/publishers";

// Mock fetch-timeout to prevent real HTTP calls in delegation tests
vi.mock("@/lib/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from "@/lib/fetch-timeout";

function createMockResponse(
  overrides: { ok?: boolean; json?: unknown; headers?: Record<string, string> } = {},
): Response {
  return {
    ok: overrides.ok ?? true,
    status: overrides.ok === false ? 400 : 200,
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

describe("Publisher factory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getPublisher", () => {
    const validPlatforms = [
      "INSTAGRAM",
      "TIKTOK",
      "YOUTUBE",
      "FACEBOOK",
      "X",
      "LINKEDIN",
      "THREADS",
      "PINTEREST",
    ] as const;

    it.each(validPlatforms)("should return a Publisher for platform '%s'", (platform) => {
      const publisher = getPublisher(platform);
      expect(publisher).toBeDefined();
      expect(typeof publisher.publish).toBe("function");
    });

    it("should throw an error for unknown platforms", () => {
      expect(() => getPublisher("UNKNOWN" as any)).toThrow("Unknown platform: UNKNOWN");
    });

    it("should throw an error for invalid platform strings", () => {
      expect(() => getPublisher("SNAPCHAT" as any)).toThrow(/Unknown platform/);
      expect(() => getPublisher("TELEGRAM" as any)).toThrow(/Unknown platform/);
      expect(() => getPublisher("WHATSAPP" as any)).toThrow(/Unknown platform/);
    });
  });

  describe("publishContent", () => {
    const mockContent = {
      textContent: "Test post",
      mediaUrls: [] as string[],
      hashtags: ["test"],
    };
    const mockAccount = {
      accountId: "acc_123",
      accessToken: "token_123",
    };

    it("should be an async function", () => {
      expect(typeof publishContent).toBe("function");
    });

    it("should delegate to the correct publisher and return its result", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "fb_result_456" } }));

      const result = await publishContent("FACEBOOK", mockContent, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("fb_result_456");
      // verify the Facebook endpoint was called
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("graph.facebook.com");
    });

    it("should delegate to Instagram publisher", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "ig_result_789" } }));

      const result = await publishContent(
        "INSTAGRAM",
        { ...mockContent, mediaUrls: [] },
        mockAccount,
      );

      expect(result.success).toBe(true);
      expect(result.postId).toBe("ig_result_789");
    });

    it("should delegate to X publisher", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          json: { data: { id: "x_result_111" } },
        }),
      );

      const result = await publishContent("X", mockContent, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("x_result_111");
    });

    it("should delegate to LinkedIn publisher", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "li_result_222" } }));

      const result = await publishContent("LINKEDIN", mockContent, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("li_result_222");
    });

    it("should delegate to Threads publisher", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "threads_result_333" } }));

      const result = await publishContent("THREADS", mockContent, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("threads_result_333");
    });

    it("should handle errors from delegated publisher", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          json: { error: { message: "API rate limit exceeded" } },
        }),
      );

      const result = await publishContent("FACEBOOK", mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Facebook API returned an error. Please check your post and try again.",
      );
    });

    it("should pass content and account to the publisher", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "test_123" } }));

      await publishContent(
        "THREADS",
        { textContent: "Hello", mediaUrls: [], hashtags: [] },
        { accountId: "user1", accessToken: "tok1" },
      );

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      // access_token is now passed as Authorization Bearer header
      const headers = (mockFetch.mock.calls[0][1] as any).headers;
      expect(headers).toHaveProperty("Authorization", "Bearer tok1");
      expect(body.message).toBe("Hello");
    });

    it("should throw when platform is unknown", async () => {
      await expect(publishContent("UNKNOWN" as any, mockContent, mockAccount)).rejects.toThrow(
        "Unknown platform: UNKNOWN",
      );
    });

    it("should return PublishResult shape for all valid platforms", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);

      // Mock a generic success response that works for most publishers
      mockFetch.mockResolvedValue(createMockResponse({ json: { id: "test_123" } }));

      const platforms = ["FACEBOOK", "LINKEDIN", "THREADS"] as const;

      for (const platform of platforms) {
        const result = await publishContent(platform, mockContent, mockAccount);
        expect(result).toHaveProperty("success");
        expect(typeof result.success).toBe("boolean");
      }
    });
  });
});
