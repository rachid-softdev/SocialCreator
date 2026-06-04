/**
 * Tests for the service-level OAuth utilities (oauth.ts)
 *
 * This module re-exports isTokenExpired and refreshAccessToken from @/lib/oauth
 * for use by other services. Tests verify the re-exports work correctly.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefreshAccessToken = vi.fn();
const mockIsTokenExpired = vi.fn();

vi.mock("@/lib/oauth", () => ({
  isTokenExpired: mockIsTokenExpired,
  refreshAccessToken: mockRefreshAccessToken,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OAuth service re-exports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isTokenExpired", () => {
    it("should be a function", async () => {
      const { isTokenExpired } = await import("@/lib/services/oauth");
      expect(typeof isTokenExpired).toBe("function");
    });

    it("should delegate to the base OAuth isTokenExpired", async () => {
      mockIsTokenExpired.mockReturnValue(true);

      const { isTokenExpired } = await import("@/lib/services/oauth");
      const futureDate = new Date(Date.now() - 10000);
      const result = isTokenExpired(futureDate);

      expect(mockIsTokenExpired).toHaveBeenCalledWith(futureDate);
      expect(result).toBe(true);
    });

    it("should return false for null expiration date", async () => {
      mockIsTokenExpired.mockReturnValue(false);

      const { isTokenExpired } = await import("@/lib/services/oauth");
      const result = isTokenExpired(null);

      expect(result).toBe(false);
    });
  });

  describe("refreshAccessToken", () => {
    it("should be a function", async () => {
      const { refreshAccessToken } = await import("@/lib/services/oauth");
      expect(typeof refreshAccessToken).toBe("function");
    });

    it("should delegate to the base OAuth refreshAccessToken", async () => {
      const mockRefreshResult = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      };
      mockRefreshAccessToken.mockResolvedValue(mockRefreshResult);

      const { refreshAccessToken } = await import("@/lib/services/oauth");
      const result = await refreshAccessToken("provider-name" as any, "refresh-token-value");

      expect(mockRefreshAccessToken).toHaveBeenCalledWith("provider-name", "refresh-token-value");
      expect(result).toEqual(mockRefreshResult);
    });

    it("should propagate errors from the base OAuth layer", async () => {
      mockRefreshAccessToken.mockRejectedValue(new Error("Token refresh failed"));

      const { refreshAccessToken } = await import("@/lib/services/oauth");
      await expect(refreshAccessToken("provider" as any, "bad-token")).rejects.toThrow(
        "Token refresh failed",
      );
    });
  });

  describe("type exports", () => {
    it("should export OAuthProvider type", async () => {
      // Type-only export — verify the module can be imported without errors
      const mod = await import("@/lib/services/oauth");
      expect(mod).toHaveProperty("isTokenExpired");
      expect(mod).toHaveProperty("refreshAccessToken");
    });
  });
});
