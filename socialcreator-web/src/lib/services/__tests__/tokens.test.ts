/**
 * Comprehensive tests for Token Service (src/lib/services/tokens.ts)
 *
 * Covers all exported functions with edge cases:
 * - Token auto-refresh on expiry
 * - ExpiresAt computation with vi.useFakeTimers
 * - Account deactivation on failed refresh
 * - Token field variations (with/without refreshToken, expiresIn)
 * - Account avatar URL handling via ?? undefined
 * - isAccountValid's direct Date comparison vs getValidAccessToken's isTokenExpired
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockConnectedAccountRepo = {
  findById: vi.fn(),
  findByProfileAndPlatform: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => ({
    connectedAccount: mockConnectedAccountRepo,
  })),
}));

vi.mock("@/lib/services/oauth", () => ({
  isTokenExpired: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (must be after mocks)
// ---------------------------------------------------------------------------

import logger from "@/lib/logger";
import { isTokenExpired, refreshAccessToken } from "@/lib/services/oauth";
import {
  createConnectedAccount,
  deactivateConnectedAccount,
  getValidAccessToken,
  getValidAccessTokenByAccount,
  isAccountValid,
  reactivateConnectedAccount,
  updateAccountToken,
  updateConnectedAccount,
} from "@/lib/services/tokens";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseAccount = {
  id: "ca-1",
  profileId: "profile-1",
  platform: "X" as const,
  accessToken: "plaintext-access-token",
  refreshToken: "plaintext-refresh-token",
  expiresAt: new Date("2030-12-31"),
  accountId: "ext-123",
  accountName: "Test Account",
  accountAvatarUrl: null,
  isActive: true,
  tokenType: null,
  scope: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Token Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===================================================================
  // getValidAccessToken
  // ===================================================================
  describe("getValidAccessToken", () => {
    it("should return decrypted accessToken when account found and token not expired", async () => {
      mockConnectedAccountRepo.findById.mockResolvedValue(baseAccount);
      vi.mocked(isTokenExpired).mockReturnValue(false);

      const result = await getValidAccessToken("ca-1");

      expect(mockConnectedAccountRepo.findById).toHaveBeenCalledWith("ca-1");
      expect(result).toBe("plaintext-access-token");
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });

    it("should return null when account not found", async () => {
      mockConnectedAccountRepo.findById.mockResolvedValue(null);

      const result = await getValidAccessToken("nonexistent");

      expect(result).toBeNull();
    });

    it("should refresh token when expired, call updateAccountToken, and return new token", async () => {
      const expiredAccount = {
        ...baseAccount,
        expiresAt: new Date("2020-01-01"),
      };
      mockConnectedAccountRepo.findById.mockResolvedValue(expiredAccount);
      vi.mocked(isTokenExpired).mockReturnValue(true);
      vi.mocked(refreshAccessToken).mockResolvedValue({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      });

      const result = await getValidAccessToken("ca-1");

      expect(refreshAccessToken).toHaveBeenCalledWith("X", "plaintext-refresh-token");
      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith(
        "ca-1",
        expect.objectContaining({
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          expiresAt: expect.any(Date),
        }),
      );
      expect(result).toBe("new-access-token");
    });

    it("should deactivate account and return null when refresh fails", async () => {
      const expiredAccount = {
        ...baseAccount,
        expiresAt: new Date("2020-01-01"),
      };
      mockConnectedAccountRepo.findById.mockResolvedValue(expiredAccount);
      vi.mocked(isTokenExpired).mockReturnValue(true);
      vi.mocked(refreshAccessToken).mockRejectedValue(new Error("Refresh failed"));

      const result = await getValidAccessToken("ca-1");

      expect(result).toBeNull();
      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith("ca-1", { isActive: false });
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          accountId: "ca-1",
        }),
        expect.stringContaining("Failed to refresh token"),
      );
    });

    it("should log error if deactivation itself fails after refresh failure", async () => {
      const expiredAccount = {
        ...baseAccount,
        expiresAt: new Date("2020-01-01"),
      };
      mockConnectedAccountRepo.findById.mockResolvedValue(expiredAccount);
      vi.mocked(isTokenExpired).mockReturnValue(true);
      vi.mocked(refreshAccessToken).mockRejectedValue(new Error("Refresh failed"));
      // Make the deactivation update reject too
      mockConnectedAccountRepo.update.mockRejectedValueOnce(new Error("Deactivation failed"));

      const result = await getValidAccessToken("ca-1");

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          accountId: "ca-1",
        }),
        expect.stringContaining("Failed to deactivate account"),
      );
    });

    it("should return the expired token when expired but has no refreshToken (current behavior)", async () => {
      const noRefreshAccount = {
        ...baseAccount,
        refreshToken: null,
        expiresAt: new Date("2020-01-01"),
      };
      mockConnectedAccountRepo.findById.mockResolvedValue(noRefreshAccount);
      vi.mocked(isTokenExpired).mockReturnValue(true);

      const result = await getValidAccessToken("ca-1");

      // Falls through the if-block and returns the existing (expired) token
      expect(result).toBe("plaintext-access-token");
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });

    it("should not call isTokenExpired when expiresAt is null (non-expiring token)", async () => {
      const noExpiryAccount = {
        ...baseAccount,
        expiresAt: null,
      };
      mockConnectedAccountRepo.findById.mockResolvedValue(noExpiryAccount);

      const result = await getValidAccessToken("ca-1");

      expect(result).toBe("plaintext-access-token");
      expect(isTokenExpired).not.toHaveBeenCalled();
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  // ===================================================================
  // updateAccountToken
  // ===================================================================
  describe("updateAccountToken", () => {
    it("should compute expiresAt = now + expiresIn * 1000 when expiresIn is provided", async () => {
      vi.useFakeTimers();
      const now = new Date("2025-06-20T12:00:00Z");
      vi.setSystemTime(now);

      const expiresIn = 3600; // 1 hour
      const expectedExpiresAt = new Date(now.getTime() + expiresIn * 1000);

      await updateAccountToken("ca-1", "new-access-token", "new-refresh-token", expiresIn);

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith("ca-1", {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        expiresAt: expectedExpiresAt,
      });

      vi.useRealTimers();
    });

    it("should not include expiresAt when expiresIn is not provided", async () => {
      await updateAccountToken("ca-1", "new-access-token");

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith("ca-1", {
        accessToken: "new-access-token",
        refreshToken: null,
        expiresAt: undefined,
      });
    });

    it("should pass null refreshToken when refreshToken is undefined", async () => {
      await updateAccountToken("ca-1", "new-access-token", undefined, 3600);

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith("ca-1", {
        accessToken: "new-access-token",
        refreshToken: null,
        expiresAt: expect.any(Date),
      });
    });

    it("should pass through refreshToken when provided as empty string", async () => {
      await updateAccountToken("ca-1", "new-access-token", "", 3600);

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith("ca-1", {
        accessToken: "new-access-token",
        refreshToken: "",
        expiresAt: expect.any(Date),
      });
    });
  });

  // ===================================================================
  // createConnectedAccount
  // ===================================================================
  describe("createConnectedAccount", () => {
    const defaultTokens = {
      access_token: "token-123",
      refresh_token: "refresh-123",
      expires_in: 7200,
    };

    const defaultAccountInfo = {
      accountId: "ext-123",
      accountName: "Test Account",
      accountAvatarUrl: null,
    };

    it("should compute expiresAt = now + expires_in * 1000 when expires_in is provided", async () => {
      vi.useFakeTimers();
      const now = new Date("2025-06-20T12:00:00Z");
      vi.setSystemTime(now);
      const expectedExpiresAt = new Date(now.getTime() + 7200 * 1000);

      mockConnectedAccountRepo.create.mockResolvedValue({
        ...baseAccount,
        expiresAt: expectedExpiresAt,
      });

      await createConnectedAccount("profile-1", "X", defaultTokens, defaultAccountInfo);

      expect(mockConnectedAccountRepo.create).toHaveBeenCalledWith({
        profileId: "profile-1",
        platform: "X",
        accessToken: "token-123",
        refreshToken: "refresh-123",
        expiresAt: expectedExpiresAt,
        accountId: "ext-123",
        accountName: "Test Account",
        accountAvatarUrl: undefined,
      });

      vi.useRealTimers();
    });

    it("should set expiresAt to undefined when expires_in is not provided", async () => {
      mockConnectedAccountRepo.create.mockResolvedValue(baseAccount);

      await createConnectedAccount(
        "profile-1",
        "X",
        { access_token: "token-123" } as any,
        defaultAccountInfo,
      );

      expect(mockConnectedAccountRepo.create).toHaveBeenCalledWith({
        profileId: "profile-1",
        platform: "X",
        accessToken: "token-123",
        refreshToken: undefined,
        expiresAt: undefined,
        accountId: "ext-123",
        accountName: "Test Account",
        accountAvatarUrl: undefined,
      });
    });

    it("should pass accountAvatarUrl through when provided (not null)", async () => {
      mockConnectedAccountRepo.create.mockResolvedValue(baseAccount);
      const infoWithAvatar = {
        ...defaultAccountInfo,
        accountAvatarUrl: "https://example.com/avatar.jpg",
      };

      await createConnectedAccount("profile-1", "X", defaultTokens, infoWithAvatar);

      expect(mockConnectedAccountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountAvatarUrl: "https://example.com/avatar.jpg",
        }),
      );
    });

    it("should set accountAvatarUrl to undefined when null (?? undefined)", async () => {
      mockConnectedAccountRepo.create.mockResolvedValue(baseAccount);

      await createConnectedAccount("profile-1", "X", defaultTokens, defaultAccountInfo);

      expect(mockConnectedAccountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountAvatarUrl: undefined,
        }),
      );
    });

    it("should return the created account from the repository", async () => {
      const created = { ...baseAccount, id: "new-ca-1" };
      mockConnectedAccountRepo.create.mockResolvedValue(created);

      const result = await createConnectedAccount(
        "profile-1",
        "X",
        defaultTokens,
        defaultAccountInfo,
      );

      expect(result).toEqual(created);
    });

    it("should set refreshToken to undefined when tokens have no refresh_token", async () => {
      mockConnectedAccountRepo.create.mockResolvedValue(baseAccount);

      await createConnectedAccount(
        "profile-1",
        "INSTAGRAM",
        { access_token: "token-123", expires_in: 3600 } as any,
        defaultAccountInfo,
      );

      expect(mockConnectedAccountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: undefined,
        }),
      );
    });
  });

  // ===================================================================
  // updateConnectedAccount
  // ===================================================================
  describe("updateConnectedAccount", () => {
    const defaultTokens = {
      access_token: "updated-token",
      refresh_token: "updated-refresh",
      expires_in: 3600,
    };

    const defaultAccountInfo = {
      accountId: "ext-123",
      accountName: "Updated Account",
      accountAvatarUrl: "https://example.com/new-avatar.jpg",
    };

    it("should update account with new tokens and account info", async () => {
      vi.useFakeTimers();
      const now = new Date("2025-06-20T12:00:00Z");
      vi.setSystemTime(now);
      const expectedExpiresAt = new Date(now.getTime() + 3600 * 1000);

      mockConnectedAccountRepo.update.mockResolvedValue(baseAccount);

      await updateConnectedAccount("ca-1", defaultTokens, defaultAccountInfo);

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith("ca-1", {
        accessToken: "updated-token",
        refreshToken: "updated-refresh",
        expiresAt: expectedExpiresAt,
        accountId: "ext-123",
        accountName: "Updated Account",
        accountAvatarUrl: "https://example.com/new-avatar.jpg",
      });

      vi.useRealTimers();
    });

    it("should pass null refreshToken when tokens lack refresh_token", async () => {
      mockConnectedAccountRepo.update.mockResolvedValue(baseAccount);

      await updateConnectedAccount(
        "ca-1",
        { access_token: "token", expires_in: 3600 } as any,
        defaultAccountInfo,
      );

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith(
        "ca-1",
        expect.objectContaining({
          refreshToken: null,
        }),
      );
    });

    it("should set expiresAt to undefined when expires_in is not provided", async () => {
      mockConnectedAccountRepo.update.mockResolvedValue(baseAccount);

      await updateConnectedAccount("ca-1", { access_token: "token" } as any, defaultAccountInfo);

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith(
        "ca-1",
        expect.objectContaining({
          expiresAt: undefined,
        }),
      );
    });

    it("should set accountAvatarUrl to undefined when null", async () => {
      mockConnectedAccountRepo.update.mockResolvedValue(baseAccount);

      await updateConnectedAccount("ca-1", defaultTokens, {
        ...defaultAccountInfo,
        accountAvatarUrl: null,
      });

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith(
        "ca-1",
        expect.objectContaining({
          accountAvatarUrl: undefined,
        }),
      );
    });

    it("should return the updated account from the repository", async () => {
      const updated = { ...baseAccount, accountName: "Updated Account" };
      mockConnectedAccountRepo.update.mockResolvedValue(updated);

      const result = await updateConnectedAccount("ca-1", defaultTokens, defaultAccountInfo);

      expect(result).toEqual(updated);
    });
  });

  // ===================================================================
  // isAccountValid
  // ===================================================================
  describe("isAccountValid", () => {
    it("should return true for active account with non-expired token", async () => {
      const activeAccount = {
        ...baseAccount,
        expiresAt: new Date("2099-12-31"),
        isActive: true,
      };
      mockConnectedAccountRepo.findById.mockResolvedValue(activeAccount);

      const result = await isAccountValid("ca-1");

      expect(result).toBe(true);
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });

    it("should return false for inactive account (no refresh attempted)", async () => {
      mockConnectedAccountRepo.findById.mockResolvedValue({
        ...baseAccount,
        isActive: false,
      });

      const result = await isAccountValid("ca-1");

      expect(result).toBe(false);
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });

    it("should return false when account not found", async () => {
      mockConnectedAccountRepo.findById.mockResolvedValue(null);

      const result = await isAccountValid("nonexistent");

      expect(result).toBe(false);
    });

    it("should refresh token and return true when expired but has refreshToken", async () => {
      const expiredAccount = {
        ...baseAccount,
        expiresAt: new Date("2020-01-01"),
      };
      mockConnectedAccountRepo.findById.mockResolvedValue(expiredAccount);
      vi.mocked(refreshAccessToken).mockResolvedValue({
        access_token: "refreshed-token",
        refresh_token: "refreshed-refresh",
        expires_in: 3600,
      });

      const result = await isAccountValid("ca-1");

      expect(result).toBe(true);
      expect(mockConnectedAccountRepo.update).toHaveBeenCalled();
    });

    it("should return false when expired, has refreshToken, but refresh fails", async () => {
      const expiredAccount = {
        ...baseAccount,
        expiresAt: new Date("2020-01-01"),
      };
      mockConnectedAccountRepo.findById.mockResolvedValue(expiredAccount);
      vi.mocked(refreshAccessToken).mockRejectedValue(new Error("Refresh failed"));

      const result = await isAccountValid("ca-1");

      expect(result).toBe(false);
    });

    it("should return false when expired and no refreshToken", async () => {
      const noRefreshAccount = {
        ...baseAccount,
        refreshToken: null,
        expiresAt: new Date("2020-01-01"),
      };
      mockConnectedAccountRepo.findById.mockResolvedValue(noRefreshAccount);

      const result = await isAccountValid("ca-1");

      expect(result).toBe(false);
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });

    it("should return true when expiresAt is null (non-expiring token, active account)", async () => {
      mockConnectedAccountRepo.findById.mockResolvedValue({
        ...baseAccount,
        expiresAt: null,
      });

      const result = await isAccountValid("ca-1");

      expect(result).toBe(true);
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  // ===================================================================
  // deactivateConnectedAccount
  // ===================================================================
  describe("deactivateConnectedAccount", () => {
    it("should call update with isActive=false", async () => {
      await deactivateConnectedAccount("ca-1");

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith("ca-1", { isActive: false });
    });
  });

  // ===================================================================
  // reactivateConnectedAccount
  // ===================================================================
  describe("reactivateConnectedAccount", () => {
    it("should call update with isActive=true", async () => {
      await reactivateConnectedAccount("ca-1");

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith("ca-1", { isActive: true });
    });
  });

  // ===================================================================
  // getValidAccessTokenByAccount
  // ===================================================================
  describe("getValidAccessTokenByAccount", () => {
    it("should find account by profile+platform and delegate to getValidAccessToken", async () => {
      mockConnectedAccountRepo.findByProfileAndPlatform.mockResolvedValue(baseAccount);
      // Inner getValidAccessToken will call findById
      mockConnectedAccountRepo.findById.mockResolvedValue(baseAccount);
      vi.mocked(isTokenExpired).mockReturnValue(false);

      const result = await getValidAccessTokenByAccount("profile-1", "X" as any);

      expect(mockConnectedAccountRepo.findByProfileAndPlatform).toHaveBeenCalledWith(
        "profile-1",
        "X",
      );
      expect(mockConnectedAccountRepo.findById).toHaveBeenCalledWith("ca-1");
      expect(result).toBe("plaintext-access-token");
    });

    it("should return null when no account found for the given profile+platform", async () => {
      mockConnectedAccountRepo.findByProfileAndPlatform.mockResolvedValue(null);

      const result = await getValidAccessTokenByAccount("profile-1", "X" as any);

      expect(result).toBeNull();
      expect(mockConnectedAccountRepo.findById).not.toHaveBeenCalled();
    });
  });
});
