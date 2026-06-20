/**
 * Tests for OAuth User Info module
 * Tests getUserInfo for all 8 providers, normalization, and error handling
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getInstagramAccountId, getUserInfo } from "../user-info";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(typeof data === "string" ? data : JSON.stringify(data)),
  } as Response;
}

describe("OAuth User Info", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getUserInfo", () => {
    // -----------------------------------------------------------------------
    // INSTAGRAM & FACEBOOK (Meta graph, same response shape)
    // -----------------------------------------------------------------------
    it("should get user info for Instagram", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          id: "ig-account-123",
          name: "Instagram User",
          picture: { data: { url: "https://ig.example.com/avatar.jpg" } },
        }),
      );

      const result = await getUserInfo("INSTAGRAM", "access-token-123");

      expect(result.accountId).toBe("ig-account-123");
      expect(result.accountName).toBe("Instagram User");
      expect(result.accountAvatarUrl).toBe("https://ig.example.com/avatar.jpg");
      expect(mockFetch.mock.calls[0][0]).toContain("graph.facebook.com");
    });

    it("should get user info for Facebook", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          id: "fb-account-456",
          name: "Facebook User",
          picture: { data: { url: "https://fb.example.com/pic.jpg" } },
        }),
      );

      const result = await getUserInfo("FACEBOOK", "fb-token");

      expect(result.accountId).toBe("fb-account-456");
      expect(result.accountName).toBe("Facebook User");
      expect(result.accountAvatarUrl).toBe("https://fb.example.com/pic.jpg");
    });

    it("should fallback to picture string if picture.data.url missing for Meta", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          id: "fb-account-789",
          name: "Fallback User",
          picture: "https://fb.example.com/fallback-pic.jpg",
        }),
      );

      const result = await getUserInfo("FACEBOOK", "token");

      expect(result.accountId).toBe("fb-account-789");
      expect(result.accountName).toBe("Fallback User");
      expect(result.accountAvatarUrl).toBe("https://fb.example.com/fallback-pic.jpg");
    });

    it("should handle null avatar for Instagram when no picture", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          id: "ig-no-pic",
          name: "No Pic User",
        }),
      );

      const result = await getUserInfo("INSTAGRAM", "token");

      expect(result.accountId).toBe("ig-no-pic");
      expect(result.accountName).toBe("No Pic User");
      expect(result.accountAvatarUrl).toBeNull();
    });

    // -----------------------------------------------------------------------
    // TIKTOK
    // -----------------------------------------------------------------------
    it("should get user info for TikTok", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          data: {
            user: {
              open_id: "tt-open-123",
              display_name: "TikTok User",
              avatar_url: "https://tt.example.com/avatar.jpg",
            },
          },
        }),
      );

      const result = await getUserInfo("TIKTOK", "tt-token");

      expect(result.accountId).toBe("tt-open-123");
      expect(result.accountName).toBe("TikTok User");
      expect(result.accountAvatarUrl).toBe("https://tt.example.com/avatar.jpg");
      expect(mockFetch.mock.calls[0][0]).toContain("tiktokapis.com");
    });

    it("should fallback to id for TikTok if open_id missing", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          data: {
            user: {
              id: "tt-legacy-id",
              display_name: "Legacy User",
            },
          },
        }),
      );

      const result = await getUserInfo("TIKTOK", "token");

      expect(result.accountId).toBe("tt-legacy-id");
    });

    it("should fallback to name for TikTok if display_name missing", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          data: {
            user: {
              open_id: "tt-456",
              name: "TikTok Name Field",
            },
          },
        }),
      );

      const result = await getUserInfo("TIKTOK", "token");

      expect(result.accountName).toBe("TikTok Name Field");
    });

    it("should return null avatar for TikTok when avatar_url missing", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          data: {
            user: {
              open_id: "tt-789",
              display_name: "No Avatar",
            },
          },
        }),
      );

      const result = await getUserInfo("TIKTOK", "token");
      expect(result.accountAvatarUrl).toBeNull();
    });

    // -----------------------------------------------------------------------
    // LINKEDIN
    // -----------------------------------------------------------------------
    it("should get user info for LinkedIn", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          sub: "li-sub-123",
          name: "LinkedIn User",
        }),
      );

      const result = await getUserInfo("LINKEDIN", "li-token");

      expect(result.accountId).toBe("li-sub-123");
      expect(result.accountName).toBe("LinkedIn User");
      expect(result.accountAvatarUrl).toBeNull();
      expect(mockFetch.mock.calls[0][0]).toContain("linkedin.com");
    });

    it("should use Bearer auth for LinkedIn", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          sub: "li-123",
          name: "Li User",
        }),
      );

      await getUserInfo("LINKEDIN", "li-my-token");

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe("Bearer li-my-token");
    });

    // -----------------------------------------------------------------------
    // X (Twitter)
    // -----------------------------------------------------------------------
    it("should get user info for X (Twitter)", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          data: {
            id: "x-id-123",
            name: "X User",
            profile_image_url: "https://x.example.com/avatar.jpg",
          },
        }),
      );

      const result = await getUserInfo("X", "x-token");

      expect(result.accountId).toBe("x-id-123");
      expect(result.accountName).toBe("X User");
      expect(result.accountAvatarUrl).toBe("https://x.example.com/avatar.jpg");
      expect(mockFetch.mock.calls[0][0]).toContain("api.twitter.com");
    });

    it("should return null avatar for X when profile_image_url is missing", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          data: {
            id: "x-456",
            name: "X User No Pic",
          },
        }),
      );

      const result = await getUserInfo("X", "token");
      expect(result.accountAvatarUrl).toBeNull();
    });

    // -----------------------------------------------------------------------
    // YOUTUBE
    // -----------------------------------------------------------------------
    it("should get user info for YouTube", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          items: [
            {
              id: "yt-channel-123",
              snippet: {
                title: "YouTube Channel",
                thumbnails: {
                  default: { url: "https://yt.example.com/avatar.jpg" },
                },
              },
            },
          ],
        }),
      );

      const result = await getUserInfo("YOUTUBE", "yt-token");

      expect(result.accountId).toBe("yt-channel-123");
      expect(result.accountName).toBe("YouTube Channel");
      expect(result.accountAvatarUrl).toBe("https://yt.example.com/avatar.jpg");
      expect(mockFetch.mock.calls[0][0]).toContain("googleapis.com");
    });

    it("should return null avatar for YouTube when thumbnails missing", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          items: [
            {
              id: "yt-456",
              snippet: {
                title: "YT Channel",
              },
            },
          ],
        }),
      );

      const result = await getUserInfo("YOUTUBE", "token");
      expect(result.accountAvatarUrl).toBeNull();
    });

    it("should return undefined for YouTube when items array is empty", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          items: [],
        }),
      );

      const result = await getUserInfo("YOUTUBE", "token");

      expect(result.accountId).toBeUndefined();
      expect(result.accountName).toBeUndefined();
      expect(result.accountAvatarUrl).toBeNull();
    });

    // -----------------------------------------------------------------------
    // PINTEREST
    // -----------------------------------------------------------------------
    it("should get user info for Pinterest", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          id: "pin-account-789",
          user: {
            first_name: "Pinterest",
            last_name: "User",
            username: "pinterest_user",
            profile_image: "https://pin.example.com/avatar.jpg",
          },
        }),
      );

      const result = await getUserInfo("PINTEREST", "pin-token");

      expect(result.accountId).toBe("pin-account-789");
      expect(result.accountName).toBe("Pinterest User");
      expect(result.accountAvatarUrl).toBe("https://pin.example.com/avatar.jpg");
      expect(mockFetch.mock.calls[0][0]).toContain("pinterest.com");
    });

    it("should fallback to data.id for Pinterest if user.id missing", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          id: "pin-id-fallback",
          user: {
            first_name: "Pin",
            last_name: "User",
            username: "pin_user",
          },
        }),
      );

      const result = await getUserInfo("PINTEREST", "token");

      expect(result.accountId).toBe("pin-id-fallback");
    });

    it("should handle missing first_name/last_name for Pinterest (returns 'undefined undefined')", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          id: "pin-1",
          user: {
            username: "just_username",
          },
        }),
      );

      const result = await getUserInfo("PINTEREST", "token");

      // ⚠ Production code: template literal `${undefined} ${undefined}` produces "undefined undefined"
      // This string is truthy so the || data.user?.username fallback never triggers.
      // This is a known code issue — the template literal should be guarded.
      expect(result.accountName).toBe("undefined undefined");
    });

    it("should handle missing profile_image for Pinterest", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          id: "pin-2",
          user: {
            first_name: "Test",
            last_name: "User",
          },
        }),
      );

      const result = await getUserInfo("PINTEREST", "token");
      expect(result.accountAvatarUrl).toBeNull();
    });

    // -----------------------------------------------------------------------
    // THREADS
    // -----------------------------------------------------------------------
    it("should get user info for Threads", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          id: "threads-account-999",
          name: "Threads User",
          username: "threads_user",
        }),
      );

      const result = await getUserInfo("THREADS", "threads-token");

      expect(result.accountId).toBe("threads-account-999");
      expect(result.accountName).toBe("Threads User");
      expect(result.accountAvatarUrl).toBeNull();
      expect(mockFetch.mock.calls[0][0]).toContain("graph.facebook.com");
    });

    it("should fallback to username for Threads when name missing", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          id: "threads-123",
          username: "threads_user_name",
        }),
      );

      const result = await getUserInfo("THREADS", "token");

      expect(result.accountName).toBe("threads_user_name");
    });

    // -----------------------------------------------------------------------
    // ERROR CASES
    // -----------------------------------------------------------------------
    it("should throw on HTTP error response", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: "invalid_token" }, false, 401));

      await expect(getUserInfo("INSTAGRAM", "bad-token")).rejects.toThrow(
        "Failed to get user info from INSTAGRAM",
      );
    });

    it("should throw on 403 forbidden", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: "insufficient_permissions" }, false, 403),
      );

      await expect(getUserInfo("LINKEDIN", "no-permission-token")).rejects.toThrow(
        "Failed to get user info from LINKEDIN",
      );
    });

    it("should throw on 404 not found", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: "not_found" }, false, 404));

      await expect(getUserInfo("YOUTUBE", "token")).rejects.toThrow(
        "Failed to get user info from YOUTUBE",
      );
    });

    it("should throw on 429 rate limit", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: "rate_limit" }, false, 429));

      await expect(getUserInfo("X", "token")).rejects.toThrow("Failed to get user info from X");
    });

    it("should throw on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Network failure"));

      await expect(getUserInfo("FACEBOOK", "token")).rejects.toThrow(TypeError);
    });

    it("should fail on unknown platform before reaching normalizeUserInfo", async () => {
      // Note: getUserInfoUrl("UNKNOWN") returns undefined, so fetchWithTimeout
      // receives undefined URL and the error stems from that, not from
      // normalizeUserInfo's "Unknown platform" throw (which is unreachable).
      const result = getUserInfo("UNKNOWN" as any, "token");
      await expect(result).rejects.toThrow();
    });

    it("should handle response JSON parse failure via HTTP error path", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse("Server Error", false, 500));

      await expect(getUserInfo("PINTEREST", "token")).rejects.toThrow(
        "Failed to get user info from PINTEREST",
      );
    });

    it("should include Bearer token in Authorization header", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          id: "test-1",
          name: "Test User",
        }),
      );

      await getUserInfo("FACEBOOK", "my-test-token-value");

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe("Bearer my-test-token-value");
      expect(headers.Accept).toBe("application/json");
    });

    it("should use correct URL for each platform", async () => {
      const testCases = [
        { platform: "INSTAGRAM" as const, expected: "graph.facebook.com" },
        { platform: "FACEBOOK" as const, expected: "graph.facebook.com" },
        { platform: "TIKTOK" as const, expected: "tiktokapis.com" },
        { platform: "LINKEDIN" as const, expected: "linkedin.com" },
        { platform: "X" as const, expected: "api.twitter.com" },
        { platform: "YOUTUBE" as const, expected: "googleapis.com" },
        { platform: "PINTEREST" as const, expected: "pinterest.com" },
        { platform: "THREADS" as const, expected: "graph.facebook.com" },
      ];

      for (const { platform, expected } of testCases) {
        mockFetch.mockResolvedValueOnce(mockResponse({ id: "test", name: "Test" }));
        await getUserInfo(platform, "token").catch(() => {});
        const url = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0];
        expect(url).toContain(expected);
      }
    });
  });

  describe("getInstagramAccountId", () => {
    it("should return Instagram business account ID from Facebook pages", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          data: [
            {
              id: "fb-page-123",
              name: "My Page",
              instagram_business_account: {
                id: "ig-biz-456",
              },
            },
          ],
        }),
      );

      const result = await getInstagramAccountId("fb-access-token");

      expect(result).toBe("ig-biz-456");
      expect(mockFetch.mock.calls[0][0]).toContain("graph.facebook.com");
      expect(mockFetch.mock.calls[0][0]).toContain("me/accounts");
    });

    it("should return null when no pages found", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          data: [],
        }),
      );

      const result = await getInstagramAccountId("token");
      expect(result).toBeNull();
    });

    it("should return null when page has no Instagram business account", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          data: [
            {
              id: "fb-page-789",
              name: "Page Without IG",
            },
          ],
        }),
      );

      const result = await getInstagramAccountId("token");
      expect(result).toBeNull();
    });

    it("should return null on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: "invalid_token" }, false, 401));

      const result = await getInstagramAccountId("bad-token");
      expect(result).toBeNull();
    });

    it("should return null on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      const result = await getInstagramAccountId("token");
      expect(result).toBeNull();
    });

    it("should include Bearer token in request headers", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          data: [
            {
              id: "page-1",
              instagram_business_account: { id: "ig-1" },
            },
          ],
        }),
      );

      await getInstagramAccountId("my-access-token");

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe("Bearer my-access-token");
    });
  });
});
