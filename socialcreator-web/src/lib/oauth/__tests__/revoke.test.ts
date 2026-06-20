/**
 * Tests for OAuth Token Revocation module
 * Tests revokeToken and revokeRefreshToken for all supported platforms
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revokeRefreshToken, revokeToken } from "../revoke";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock logger
vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

function mockResponse(ok: boolean, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
  } as Response;
}

describe("OAuth Token Revocation", () => {
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
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("revokeToken", () => {
    // Meta platforms (INSTAGRAM, FACEBOOK, THREADS)
    it("should revoke Instagram token via Meta API", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(true));

      const result = await revokeToken("INSTAGRAM", "ig-token");

      expect(result).toBe(true);
      expect(mockFetch.mock.calls[0][0]).toBe("https://graph.facebook.com/v18.0/me/permissions");
      expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("Bearer ig-token");
    });

    it("should revoke Facebook token via Meta API", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(true));

      const result = await revokeToken("FACEBOOK", "fb-token");

      expect(result).toBe(true);
    });

    it("should revoke Threads token via Meta API", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(true));

      const result = await revokeToken("THREADS", "threads-token");

      expect(result).toBe(true);
    });

    it("should return false when Meta revocation fails", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(false, 403));

      const result = await revokeToken("FACEBOOK", "bad-token");
      expect(result).toBe(false);
    });

    // YouTube (Google)
    it("should revoke YouTube token via Google API", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(true));

      const result = await revokeToken("YOUTUBE", "yt-token");

      expect(result).toBe(true);
      expect(mockFetch.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/revoke");
      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
      expect(mockFetch.mock.calls[0][1].body).toContain("token=yt-token");
    });

    it("should return true when Google revocation returns 400 (already revoked)", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(false, 400));

      const result = await revokeToken("YOUTUBE", "already-revoked");
      expect(result).toBe(true);
    });

    it("should return false when Google revocation returns non-400 error", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(false, 500));

      const result = await revokeToken("YOUTUBE", "token");
      expect(result).toBe(false);
    });

    // X (Twitter)
    it("should revoke X token via Twitter API with Basic auth", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(true));

      const result = await revokeToken("X", "x-token");

      expect(result).toBe(true);
      expect(mockFetch.mock.calls[0][0]).toBe("https://api.twitter.com/2/oauth2/revoke");
      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
      expect(mockFetch.mock.calls[0][1].body).toContain("token=x-token");
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toContain("Basic ");
    });

    it("should return false when X revocation fails", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(false, 401));

      const result = await revokeToken("X", "bad-token");
      expect(result).toBe(false);
    });

    it("should return false when X clientId is missing", async () => {
      delete process.env.X_CLIENT_ID;

      const result = await revokeToken("X", "token");
      expect(result).toBe(false);
    });

    // LinkedIn
    it("should revoke LinkedIn token", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(true));

      const result = await revokeToken("LINKEDIN", "li-token");

      expect(result).toBe(true);
      expect(mockFetch.mock.calls[0][0]).toBe("https://www.linkedin.com/oauth/v2/revoke");
      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
      expect(mockFetch.mock.calls[0][1].body).toContain("token=li-token");
    });

    it("should return false when LinkedIn revocation fails", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(false, 403));

      const result = await revokeToken("LINKEDIN", "bad-token");
      expect(result).toBe(false);
    });

    // Pinterest (no public revocation endpoint)
    it("should return false for Pinterest (no revocation endpoint)", async () => {
      const result = await revokeToken("PINTEREST", "pin-token");
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    // TikTok
    it("should return false for TikTok (no revocation endpoint)", async () => {
      const result = await revokeToken("TIKTOK", "tt-token");
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    // Error handling
    it("should return false when fetch throws an error", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Network error"));

      const result = await revokeToken("FACEBOOK", "token");
      expect(result).toBe(false);
    });

    it("should handle unknown platform gracefully", async () => {
      const result = await revokeToken("UNKNOWN" as any, "token");
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should make DELETE request for Meta platforms", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(true));

      await revokeToken("INSTAGRAM", "token");

      expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
    });

    it("should make POST request for Google/YouTube", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(true));

      await revokeToken("YOUTUBE", "token");

      expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    });
  });

  describe("revokeRefreshToken", () => {
    it("should revoke YouTube refresh token via Google API with Basic auth", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(true));

      const result = await revokeRefreshToken("YOUTUBE", "yt-refresh-token");

      expect(result).toBe(true);
      expect(mockFetch.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/revoke");
      expect(mockFetch.mock.calls[0][1].body).toContain("token=yt-refresh-token");
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toContain("Basic ");
    });

    it("should return true when Google refresh token revocation returns 400", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(false, 400));

      const result = await revokeRefreshToken("YOUTUBE", "already-revoked-refresh");
      expect(result).toBe(true);
    });

    it("should return false when Google credentials missing for YouTube refresh", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const result = await revokeRefreshToken("YOUTUBE", "token");
      expect(result).toBe(false);
    });

    it("should revoke LinkedIn refresh token", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(true));

      const result = await revokeRefreshToken("LINKEDIN", "li-refresh-token");

      expect(result).toBe(true);
      expect(mockFetch.mock.calls[0][0]).toBe("https://www.linkedin.com/oauth/v2/revoke");
      expect(mockFetch.mock.calls[0][1].body).toContain("token=li-refresh-token");
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toContain("Basic ");
    });

    it("should return false when LinkedIn credentials missing", async () => {
      delete process.env.LINKEDIN_CLIENT_ID;
      delete process.env.LINKEDIN_CLIENT_SECRET;

      const result = await revokeRefreshToken("LINKEDIN", "token");
      expect(result).toBe(false);
    });

    it("should warn and return false for platforms without refresh token revocation", async () => {
      const logger = await import("@/lib/logger");
      const warnSpy = vi.spyOn(logger.default, "warn");

      const result = await revokeRefreshToken("FACEBOOK", "fb-refresh-token");

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        { platform: "FACEBOOK" },
        "Refresh token revocation not implemented",
      );
    });

    it("should warn and return false for Instagram (no refresh revocation)", async () => {
      const logger = await import("@/lib/logger");
      const warnSpy = vi.spyOn(logger.default, "warn");

      const result = await revokeRefreshToken("INSTAGRAM", "token");

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    });

    it("should handle fetch error during refresh token revocation gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Network failure"));

      // YouTube revokeRefreshToken doesn't catch errors internally,
      // so it will propagate
      await expect(revokeRefreshToken("YOUTUBE", "token")).rejects.toThrow(TypeError);
    });
  });
});
