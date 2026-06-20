/**
 * Tests for OAuth Token Exchange module
 * Tests code exchange, token refresh, and expiration helpers with mocked HTTP
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateExpiresAt,
  exchangeCodeForToken,
  isTokenExpired,
  refreshAccessToken,
} from "../token-exchange";

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

describe("OAuth Token Exchange", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.META_CLIENT_ID = "meta-client-123";
    process.env.META_CLIENT_SECRET = "meta-secret-456";
    process.env.GOOGLE_CLIENT_ID = "google-client-789";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret-012";
    process.env.X_CLIENT_ID = "x-client-345";
    process.env.X_CLIENT_SECRET = "x-secret-678";
    process.env.LINKEDIN_CLIENT_ID = "li-client-901";
    process.env.LINKEDIN_CLIENT_SECRET = "li-secret-234";
    process.env.TIKTOK_CLIENT_KEY = "tt-client-567";
    process.env.TIKTOK_CLIENT_SECRET = "tt-secret-890";
    process.env.PINTEREST_CLIENT_ID = "pin-client-111";
    process.env.PINTEREST_CLIENT_SECRET = "pin-secret-222";
    process.env.AUTH_URL = "https://socialcreator.app";

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00.000Z"));
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
  });

  describe("exchangeCodeForToken", () => {
    it("should exchange a code for an access token on Facebook", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "fb-access-token-123",
          token_type: "Bearer",
          expires_in: 3600,
        }),
      );

      const result = await exchangeCodeForToken(
        "FACEBOOK",
        "auth-code-xyz",
        "https://socialcreator.app/api/connected-accounts/callback/facebook",
      );

      expect(result.access_token).toBe("fb-access-token-123");
      expect(result.token_type).toBe("Bearer");
      expect(result.expires_in).toBe(3600);

      // Verify fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callUrl = mockFetch.mock.calls[0][0];
      const callOptions = mockFetch.mock.calls[0][1];

      expect(callUrl).toBe("https://graph.facebook.com/v18.0/oauth/access_token");
      expect(callOptions.method).toBe("POST");
      expect(callOptions.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
      expect(callOptions.body).toContain("code=auth-code-xyz");
      expect(callOptions.body).toContain("grant_type=authorization_code");
      expect(callOptions.body).toContain("client_id=meta-client-123");
      expect(callOptions.body).toContain("client_secret=meta-secret-456");
    });

    it("should exchange a code for X with PKCE code_verifier", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "x-access-token",
          token_type: "Bearer",
          expires_in: 7200,
          refresh_token: "x-refresh-token",
          scope: "tweet.read tweet.write",
        }),
      );

      // Generate a real state with PKCE verifier
      const { generateState, generatePKCEVerifier } = await import("../auth-url");
      const verifier = generatePKCEVerifier();
      const state = generateState("X", "profile-x", verifier);

      const result = await exchangeCodeForToken(
        "X",
        "x-auth-code",
        "https://socialcreator.app/api/connected-accounts/callback/x",
        state,
      );

      expect(result.access_token).toBe("x-access-token");
      expect(result.refresh_token).toBe("x-refresh-token");
      expect(result.scope).toBe("tweet.read tweet.write");

      // Verify PKCE code_verifier in body
      const callBody = mockFetch.mock.calls[0][1].body;
      expect(callBody).toContain(`code_verifier=${encodeURIComponent(verifier)}`);
      expect(callBody).toContain("grant_type=authorization_code");
    });

    it("should throw if code_verifier missing for X platform", async () => {
      await expect(
        exchangeCodeForToken(
          "X",
          "code",
          "https://socialcreator.app/api/connected-accounts/callback/x",
          // No state with verifier
        ),
      ).rejects.toThrow("Missing code_verifier in state for X platform");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should use Basic auth for X platform", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "x-token",
        }),
      );

      const { generateState, generatePKCEVerifier } = await import("../auth-url");
      const verifier = generatePKCEVerifier();
      const state = generateState("X", "profile-x", verifier);

      await exchangeCodeForToken(
        "X",
        "code",
        "https://socialcreator.app/api/connected-accounts/callback/x",
        state,
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toContain("Basic ");
      // Body should NOT have client_id/client_secret since auth is basic
      const body = mockFetch.mock.calls[0][1].body;
      expect(body).not.toContain("client_id");
      expect(body).not.toContain("client_secret");
    });

    it("should use Basic auth for LinkedIn platform", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "li-token",
        }),
      );

      await exchangeCodeForToken(
        "LINKEDIN",
        "code",
        "https://socialcreator.app/api/connected-accounts/callback/linkedin",
      );

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toContain("Basic ");
    });

    it("should throw if credentials are not configured", async () => {
      delete process.env.META_CLIENT_ID;
      await expect(
        exchangeCodeForToken(
          "FACEBOOK",
          "code",
          "https://socialcreator.app/api/connected-accounts/callback/facebook",
        ),
      ).rejects.toThrow("OAuth credentials not configured for FACEBOOK");
    });

    it("should throw on HTTP error response", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ error: "invalid_grant", error_description: "Code expired" }, false, 400),
      );

      await expect(
        exchangeCodeForToken(
          "FACEBOOK",
          "expired-code",
          "https://socialcreator.app/api/connected-accounts/callback/facebook",
        ),
      ).rejects.toThrow("Token exchange failed for FACEBOOK");
    });

    it("should throw if response has no access_token", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ token_type: "Bearer" }));

      await expect(
        exchangeCodeForToken(
          "FACEBOOK",
          "code",
          "https://socialcreator.app/api/connected-accounts/callback/facebook",
        ),
      ).rejects.toThrow("No access token in response for FACEBOOK");
    });

    it("should exchange code for TikTok", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "tt-access-token",
          expires_in: 86400,
        }),
      );

      const result = await exchangeCodeForToken(
        "TIKTOK",
        "tt-code",
        "https://socialcreator.app/api/connected-accounts/callback/tiktok",
      );

      expect(result.access_token).toBe("tt-access-token");
      expect(mockFetch.mock.calls[0][0]).toBe("https://open.tiktokapis.com/v2/oauth/access_token/");
    });

    it("should exchange a code for Instagram (Meta body auth)", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "ig-access-token-456",
          token_type: "Bearer",
          expires_in: 5184000, // 60 days
        }),
      );

      const result = await exchangeCodeForToken(
        "INSTAGRAM",
        "ig-auth-code",
        "https://socialcreator.app/api/connected-accounts/callback/instagram",
      );

      expect(result.access_token).toBe("ig-access-token-456");
      expect(result.token_type).toBe("Bearer");
      expect(result.expires_in).toBe(5184000);

      const callUrl = mockFetch.mock.calls[0][0];
      const callBody = mockFetch.mock.calls[0][1].body;
      expect(callUrl).toBe("https://graph.facebook.com/v18.0/oauth/access_token");
      expect(callBody).toContain("client_id=meta-client-123");
      expect(callBody).toContain("client_secret=meta-secret-456");
      expect(callBody).toContain("grant_type=authorization_code");
    });

    it("should exchange a code for YouTube (Google OAuth)", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "yt-access-token-789",
          refresh_token: "yt-refresh-token-789",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "https://www.googleapis.com/auth/youtube.force-ssl",
        }),
      );

      const result = await exchangeCodeForToken(
        "YOUTUBE",
        "yt-auth-code",
        "https://socialcreator.app/api/connected-accounts/callback/youtube",
      );

      expect(result.access_token).toBe("yt-access-token-789");
      expect(result.refresh_token).toBe("yt-refresh-token-789");
      expect(result.expires_in).toBe(3600);
      expect(result.scope).toContain("youtube");

      const callUrl = mockFetch.mock.calls[0][0];
      const callBody = mockFetch.mock.calls[0][1].body;
      expect(callUrl).toBe("https://oauth2.googleapis.com/token");
      expect(callBody).toContain("client_id=google-client-789");
      expect(callBody).toContain("client_secret=google-secret-012");
    });

    it("should exchange a code for Pinterest", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "pin-access-token-111",
          refresh_token: "pin-refresh-token-222",
          expires_in: 7776000, // 90 days
          token_type: "Bearer",
        }),
      );

      const result = await exchangeCodeForToken(
        "PINTEREST",
        "pin-auth-code",
        "https://socialcreator.app/api/connected-accounts/callback/pinterest",
      );

      expect(result.access_token).toBe("pin-access-token-111");
      expect(result.refresh_token).toBe("pin-refresh-token-222");
      expect(result.expires_in).toBe(7776000);

      const callUrl = mockFetch.mock.calls[0][0];
      const callBody = mockFetch.mock.calls[0][1].body;
      expect(callUrl).toBe("https://api.pinterest.com/v5/oauth/access_token");
      expect(callBody).toContain("client_id=pin-client-111");
      expect(callBody).toContain("client_secret=pin-secret-222");
      expect(callBody).toContain("grant_type=authorization_code");
    });

    it("should exchange a code for Threads (Meta body auth)", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "threads-access-token",
          token_type: "Bearer",
          expires_in: 5184000,
        }),
      );

      const result = await exchangeCodeForToken(
        "THREADS",
        "threads-auth-code",
        "https://socialcreator.app/api/connected-accounts/callback/threads",
      );

      expect(result.access_token).toBe("threads-access-token");

      const callUrl = mockFetch.mock.calls[0][0];
      const callBody = mockFetch.mock.calls[0][1].body;
      expect(callUrl).toBe("https://graph.facebook.com/v18.0/oauth/access_token");
      expect(callBody).toContain("client_id=meta-client-123");
      expect(callBody).toContain("client_secret=meta-secret-456");
    });

    it("should throw on network failure during token exchange", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      await expect(
        exchangeCodeForToken(
          "FACEBOOK",
          "code",
          "https://socialcreator.app/api/connected-accounts/callback/facebook",
        ),
      ).rejects.toThrow(TypeError);
    });

    it("should handle extra/unexpected fields in provider response", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "token-with-extras",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "refresh-extra",
          scope: "read write",
          extra_field: "unexpected",
          nested: { value: 42 },
          provider_specific: "should-be-ignored",
        }),
      );

      const result = await exchangeCodeForToken(
        "INSTAGRAM",
        "code",
        "https://socialcreator.app/api/connected-accounts/callback/instagram",
      );

      expect(result.access_token).toBe("token-with-extras");
      expect(result.refresh_token).toBe("refresh-extra");
      expect(result.expires_in).toBe(3600);
      expect(result.scope).toBe("read write");
      // Extra fields should simply be ignored by the normalizer
      expect(Object.keys(result)).not.toContain("extra_field");
      expect(Object.keys(result)).not.toContain("nested");
    });

    it("should handle token response with very short expiry (60 seconds)", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "short-lived-token",
          expires_in: 60,
        }),
      );

      const result = await exchangeCodeForToken(
        "FACEBOOK",
        "code",
        "https://socialcreator.app/api/connected-accounts/callback/facebook",
      );

      expect(result.access_token).toBe("short-lived-token");
      expect(result.expires_in).toBe(60);
    });

    it("should handle response with no expires_in", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "no-expiry-token",
        }),
      );

      const result = await exchangeCodeForToken(
        "FACEBOOK",
        "code",
        "https://socialcreator.app/api/connected-accounts/callback/facebook",
      );

      expect(result.access_token).toBe("no-expiry-token");
      expect(result.expires_in).toBeUndefined();
      expect(result.scope).toBeUndefined();
    });

    it("should throw on expired authorization code (400 invalid_grant)", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(
          { error: "invalid_grant", error_description: "The authorization code has expired" },
          false,
          400,
        ),
      );

      await expect(
        exchangeCodeForToken(
          "LINKEDIN",
          "expired-code",
          "https://socialcreator.app/api/connected-accounts/callback/linkedin",
        ),
      ).rejects.toThrow("Token exchange failed for LINKEDIN");
    });

    it("should throw on 401 unauthorized response", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: "invalid_client" }, false, 401));

      await expect(
        exchangeCodeForToken(
          "TIKTOK",
          "bad-client-code",
          "https://socialcreator.app/api/connected-accounts/callback/tiktok",
        ),
      ).rejects.toThrow("Token exchange failed for TIKTOK");
    });

    it("should throw if state is tampered/invalid for X platform", async () => {
      await expect(
        exchangeCodeForToken(
          "X",
          "code",
          "https://socialcreator.app/api/connected-accounts/callback/x",
          "tampered:state:string",
        ),
      ).rejects.toThrow("Missing code_verifier in state for X platform");
    });

    it("should not include client credentials in body when using Basic auth for X", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ access_token: "x-token" }));

      const { generateState, generatePKCEVerifier } = await import("../auth-url");
      const verifier = generatePKCEVerifier();
      const state = generateState("X", "profile-x", verifier);

      await exchangeCodeForToken(
        "X",
        "code",
        "https://socialcreator.app/api/connected-accounts/callback/x",
        state,
      );

      const callBody = mockFetch.mock.calls[0][1].body;
      expect(callBody).not.toContain("client_id");
      expect(callBody).not.toContain("client_secret");
      expect(callBody).toContain("code_verifier");
    });
  });

  describe("refreshAccessToken", () => {
    it("should refresh an access token", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "new-access-token",
          expires_in: 3600,
          refresh_token: "new-refresh-token",
        }),
      );

      const result = await refreshAccessToken("FACEBOOK", "old-refresh-token");

      expect(result.access_token).toBe("new-access-token");
      expect(result.refresh_token).toBe("new-refresh-token");
      expect(result.expires_in).toBe(3600);

      // Verify body contains refresh_token
      const body = mockFetch.mock.calls[0][1].body;
      expect(body).toContain("refresh_token=old-refresh-token");
      expect(body).toContain("grant_type=refresh_token");
    });

    it("should throw if credentials are not configured", async () => {
      delete process.env.META_CLIENT_SECRET;
      await expect(refreshAccessToken("FACEBOOK", "refresh-token")).rejects.toThrow(
        "OAuth credentials not configured for FACEBOOK",
      );
    });

    it("should throw on HTTP error during refresh", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: "invalid_grant" }, false, 400));

      await expect(refreshAccessToken("FACEBOOK", "invalid-refresh")).rejects.toThrow(
        "Token refresh failed for FACEBOOK",
      );
    });

    it("should throw if response has no access_token", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}));

      await expect(refreshAccessToken("FACEBOOK", "refresh")).rejects.toThrow(
        "No access token in response for FACEBOOK",
      );
    });

    it("should refresh Instagram (Meta) token with body auth", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "ig-new-access-token",
          expires_in: 5184000,
        }),
      );

      const result = await refreshAccessToken("INSTAGRAM", "ig-old-refresh");

      expect(result.access_token).toBe("ig-new-access-token");
      const callUrl = mockFetch.mock.calls[0][0];
      const callBody = mockFetch.mock.calls[0][1].body;
      expect(callUrl).toBe("https://graph.facebook.com/v18.0/oauth/access_token");
      expect(callBody).toContain("client_id=meta-client-123");
      expect(callBody).toContain("client_secret=meta-secret-456");
      expect(callBody).toContain("refresh_token=ig-old-refresh");
      expect(callBody).toContain("grant_type=refresh_token");
    });

    it("should refresh YouTube token", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "yt-new-access",
          refresh_token: "yt-new-refresh",
          expires_in: 3600,
        }),
      );

      const result = await refreshAccessToken("YOUTUBE", "yt-old-refresh");

      expect(result.access_token).toBe("yt-new-access");
      expect(result.refresh_token).toBe("yt-new-refresh");

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toBe("https://oauth2.googleapis.com/token");
    });

    it("should refresh X token with Basic auth", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "x-new-access",
          expires_in: 7200,
        }),
      );

      const result = await refreshAccessToken("X", "x-old-refresh");

      expect(result.access_token).toBe("x-new-access");
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toContain("Basic ");
      const callBody = mockFetch.mock.calls[0][1].body;
      expect(callBody).not.toContain("client_id");
      expect(callBody).not.toContain("client_secret");
      expect(callBody).toContain("refresh_token=x-old-refresh");
    });

    it("should refresh LinkedIn token with Basic auth", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "li-new-access",
          expires_in: 86400,
        }),
      );

      const result = await refreshAccessToken("LINKEDIN", "li-old-refresh");

      expect(result.access_token).toBe("li-new-access");
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toContain("Basic ");
      const callBody = mockFetch.mock.calls[0][1].body;
      expect(callBody).not.toContain("client_id");
      expect(callBody).not.toContain("client_secret");
      expect(callBody).toContain("refresh_token=li-old-refresh");
    });

    it("should throw on network failure during refresh", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Network error"));

      await expect(refreshAccessToken("FACEBOOK", "refresh")).rejects.toThrow(TypeError);
    });

    it("should throw when provider returns 429 rate limit during refresh", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: "rate_limit_exceeded" }, false, 429));

      await expect(refreshAccessToken("FACEBOOK", "refresh")).rejects.toThrow(
        "Token refresh failed for FACEBOOK",
      );
    });

    it("should handle refresh response with extra fields", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          access_token: "new-token",
          refresh_token: "new-refresh",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "read write",
          extra_info: { key: "value" },
        }),
      );

      const result = await refreshAccessToken("FACEBOOK", "old-refresh");

      expect(result.access_token).toBe("new-token");
      expect(result.refresh_token).toBe("new-refresh");
      expect(result.expires_in).toBe(3600);
      expect(result.scope).toBe("read write");
    });
  });

  describe("isTokenExpired", () => {
    it("should return false for null expiration", () => {
      expect(isTokenExpired(null)).toBe(false);
    });

    it("should return true for past expiration", () => {
      const past = new Date("2025-05-01T12:00:00.000Z");
      expect(isTokenExpired(past)).toBe(true);
    });

    it("should return true when token expires within 5 minutes", () => {
      const nearFuture = new Date("2025-06-01T12:04:00.000Z");
      expect(isTokenExpired(nearFuture)).toBe(true);
    });

    it("should return false when token expires more than 5 minutes from now", () => {
      const farFuture = new Date("2025-06-01T12:06:00.000Z");
      expect(isTokenExpired(farFuture)).toBe(false);
    });

    it("should return false for current time + 5min exactly", () => {
      const exactly5Min = new Date("2025-06-01T12:05:00.000Z");
      // 5 minutes from now is the threshold, so it should be considered expired
      // (expiresAt < fiveMinutesFromNow, not <=)
      expect(isTokenExpired(exactly5Min)).toBe(false);
    });
  });

  describe("calculateExpiresAt", () => {
    it("should calculate expiration from expires_in seconds", () => {
      const result = calculateExpiresAt(3600);
      expect(result.getTime()).toBe(new Date("2025-06-01T13:00:00.000Z").getTime());
    });

    it("should handle 0 seconds", () => {
      const result = calculateExpiresAt(0);
      expect(result.getTime()).toBe(new Date("2025-06-01T12:00:00.000Z").getTime());
    });

    it("should handle negative seconds (past expiration)", () => {
      const result = calculateExpiresAt(-3600);
      expect(result.getTime()).toBe(new Date("2025-06-01T11:00:00.000Z").getTime());
    });

    it("should handle large values (30 days)", () => {
      const result = calculateExpiresAt(2592000);
      expect(result.getTime()).toBe(new Date("2025-07-01T12:00:00.000Z").getTime());
    });

    it("should handle fractional seconds (not truncated)", () => {
      const result = calculateExpiresAt(3600.7);
      // The function does not truncate; 3600.7 * 1000 = 3,600,700 ms
      const expectedMs = new Date("2025-06-01T12:00:00.000Z").getTime() + 3600.7 * 1000;
      expect(result.getTime()).toBe(expectedMs);
    });
  });
});
