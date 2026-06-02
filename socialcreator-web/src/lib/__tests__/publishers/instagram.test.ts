import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishToInstagram } from "../../publishers/instagram";

vi.mock("@/lib/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from "@/lib/fetch-timeout";

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

describe("publishToInstagram", () => {
  const mockContent = {
    textContent: "Check out our new post!",
    mediaUrls: [] as string[],
    hashtags: ["instagram", "social"],
  };
  const mockAccount = {
    accountId: "ig_user_123",
    accessToken: "ig-token",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("media post (two-step flow)", () => {
    const contentWithMedia = {
      ...mockContent,
      mediaUrls: ["https://example.com/image.jpg"],
    };

    it("should publish successfully with media", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ json: { id: "media_123" } }))
        .mockResolvedValueOnce(createMockResponse({ json: { id: "ig_456" } }));

      const result = await publishToInstagram(contentWithMedia, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("ig_456");
    });

    it("should make two API calls in the media flow", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ json: { id: "media_123" } }))
        .mockResolvedValueOnce(createMockResponse({ json: { id: "ig_456" } }));

      await publishToInstagram(contentWithMedia, mockAccount);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const firstUrl = mockFetch.mock.calls[0][0] as string;
      const secondUrl = mockFetch.mock.calls[1][0] as string;
      expect(firstUrl).toContain("/media");
      expect(secondUrl).toContain("/media_publish");
    });

    it("should return error when media container creation fails", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          json: { error: { message: "Invalid image URL" } },
        }),
      );

      const result = await publishToInstagram(contentWithMedia, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Instagram API error: 200");
      // Second call should not happen
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should return error when container publish fails", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ json: { id: "media_123" } }))
        .mockResolvedValueOnce(
          createMockResponse({
            json: { error: { message: "Publish limit reached" } },
          }),
        );

      const result = await publishToInstagram(contentWithMedia, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Instagram API error: 200");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should pass caption with hashtags to media container", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ json: { id: "media_123" } }))
        .mockResolvedValueOnce(createMockResponse({ json: { id: "ig_456" } }));

      await publishToInstagram(contentWithMedia, mockAccount);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.image_url).toBe("https://example.com/image.jpg");
      expect(body.caption).toContain("#instagram #social");
      // access_token is now passed as URL query parameter, not in body
      const firstUrl = mockFetch.mock.calls[0][0] as string;
      expect(firstUrl).toContain("access_token=ig-token");
    });

    it("should pass creation_id to media_publish endpoint", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ json: { id: "media_123" } }))
        .mockResolvedValueOnce(createMockResponse({ json: { id: "ig_456" } }));

      await publishToInstagram(contentWithMedia, mockAccount);

      const body = JSON.parse((mockFetch.mock.calls[1][1] as RequestInit).body as string);
      expect(body.creation_id).toBe("media_123");
    });
  });

  describe("text-only post (single-step flow)", () => {
    it("should publish text-only post successfully", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "ig_789" } }));

      const result = await publishToInstagram(mockContent, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("ig_789");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should POST to feed endpoint for text-only post", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "ig_789" } }));

      await publishToInstagram(mockContent, mockAccount);

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain("/feed");
    });

    it("should return error when text-only post fails", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          json: { error: { message: "Daily post limit reached" } },
        }),
      );

      const result = await publishToInstagram(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Instagram API error: 200");
    });
  });

  describe("edge cases", () => {
    it("should handle empty textContent with media present", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ json: { id: "media_123" } }))
        .mockResolvedValueOnce(createMockResponse({ json: { id: "ig_456" } }));

      const result = await publishToInstagram(
        { ...mockContent, textContent: "", mediaUrls: ["https://example.com/img.jpg"] },
        mockAccount,
      );

      expect(result.success).toBe(true);
      // Caption should still include hashtags
      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.caption).toContain("#instagram #social");
    });

    it("should handle empty textContent with text-only path", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "ig_789" } }));

      const result = await publishToInstagram(
        { ...mockContent, textContent: "", mediaUrls: [] },
        mockAccount,
      );

      expect(result.success).toBe(true);
      // Message should still include hashtags
      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      // caption is built from `${textContent}\n\n${hashtags}`
      // When textContent is empty, it becomes `\n\n#instagram #social`
      expect(body.message).toContain("#instagram #social");
    });

    it("should handle empty mediaUrls (text-only path)", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "ig_789" } }));

      const result = await publishToInstagram({ ...mockContent, mediaUrls: [] }, mockAccount);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should return error on network failure", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const result = await publishToInstagram(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network failure");
    });

    it("should return generic error for non-Error thrown values", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValueOnce("String error");

      const result = await publishToInstagram(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("SSRF prevention", () => {
    it("should reject media URLs with private IP addresses", async () => {
      const result = await publishToInstagram(
        {
          ...mockContent,
          mediaUrls: ["https://10.0.0.1/internal-image.jpg"],
        },
        mockAccount,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid media URL");
      expect(result.error).toContain("Private IP");
      // fetchWithTimeout should never be called — validation happens before API call
      expect(fetchWithTimeout).not.toHaveBeenCalled();
    });
  });
});
