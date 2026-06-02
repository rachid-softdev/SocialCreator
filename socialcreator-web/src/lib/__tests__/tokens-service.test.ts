/**
 * Tests for Token Service (src/lib/services/tokens.ts)
 *
 * Verifies:
 * - getValidAccessToken() uses repository findById (not direct prisma)
 * - updateAccountToken() uses repository update (not direct prisma)
 * - createConnectedAccount() uses repository create (not direct prisma)
 * - Token refresh flow works with repository
 * - Backward compatibility
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock repositories
const mockConnectedAccountRepo = {
  findById: vi.fn(),
  findByProfileAndPlatform: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByProfileId: vi.fn(),
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => ({
    connectedAccount: mockConnectedAccountRepo,
  })),
}));

// Mock crypto (used for manual decrypt in refresh flow)
vi.mock("@/lib/crypto", () => ({
  decryptToken: vi.fn((token: string) => `decrypted-${token}`),
  encryptToken: vi.fn((token: string) => `encrypted-${token}`),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock OAuth service (tokens.ts uses relative import ./oauth which resolves to @/lib/services/oauth)
vi.mock("@/lib/services/oauth", () => ({
  isTokenExpired: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

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
} from "@/lib/services/tokens";

describe("Token Service (repository-based)", () => {
  const mockAccount = {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getValidAccessToken", () => {
    it("should use repository findById (not direct prisma)", async () => {
      mockConnectedAccountRepo.findById.mockResolvedValue(mockAccount);
      (isTokenExpired as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const token = await getValidAccessToken("ca-1");

      expect(mockConnectedAccountRepo.findById).toHaveBeenCalledWith("ca-1");
      expect(token).toBe("plaintext-access-token");
    });

    it("should return null when account not found", async () => {
      mockConnectedAccountRepo.findById.mockResolvedValue(null);

      const token = await getValidAccessToken("nonexistent");
      expect(token).toBeNull();
    });

    it("should refresh token when expired and has refreshToken", async () => {
      const expiredAccount = {
        ...mockAccount,
        expiresAt: new Date("2020-01-01"),
      };
      mockConnectedAccountRepo.findById.mockResolvedValue(expiredAccount);
      (isTokenExpired as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (refreshAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      });

      const token = await getValidAccessToken("ca-1");

      expect(refreshAccessToken).toHaveBeenCalled();
      expect(mockConnectedAccountRepo.update).toHaveBeenCalled();
      expect(token).toBe("new-access-token");
    });

    it("should return null when refresh fails and deactivate account", async () => {
      const expiredAccount = {
        ...mockAccount,
        expiresAt: new Date("2020-01-01"),
      };
      mockConnectedAccountRepo.findById.mockResolvedValue(expiredAccount);
      (isTokenExpired as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (refreshAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Refresh failed"),
      );

      const token = await getValidAccessToken("ca-1");

      expect(token).toBeNull();
      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith("ca-1", { isActive: false });
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          accountId: "ca-1",
        }),
        expect.stringContaining("Failed to refresh token"),
      );
    });

    it("should return access token when not expired", async () => {
      mockConnectedAccountRepo.findById.mockResolvedValue(mockAccount);
      (isTokenExpired as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const token = await getValidAccessToken("ca-1");

      expect(token).toBe("plaintext-access-token");
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  describe("updateAccountToken", () => {
    it("should use repository update (not direct prisma)", async () => {
      mockConnectedAccountRepo.update.mockResolvedValue(mockAccount);

      await updateAccountToken("ca-1", "new-access-token", "new-refresh-token", 3600);

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith(
        "ca-1",
        expect.objectContaining({
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          expiresAt: expect.any(Date),
        }),
      );
    });

    it("should handle update without refreshToken", async () => {
      mockConnectedAccountRepo.update.mockResolvedValue(mockAccount);

      await updateAccountToken("ca-1", "new-access-token");

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith(
        "ca-1",
        expect.objectContaining({
          accessToken: "new-access-token",
          refreshToken: null,
        }),
      );
    });

    it("should handle update without expiresIn", async () => {
      mockConnectedAccountRepo.update.mockResolvedValue(mockAccount);

      await updateAccountToken("ca-1", "token");

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith(
        "ca-1",
        expect.objectContaining({
          expiresAt: undefined,
        }),
      );
    });
  });

  describe("createConnectedAccount", () => {
    it("should use repository create (not direct prisma)", async () => {
      mockConnectedAccountRepo.create.mockResolvedValue(mockAccount);

      const result = await createConnectedAccount(
        "profile-1",
        "X",
        {
          access_token: "new-token",
          refresh_token: "new-refresh",
          expires_in: 3600,
        },
        {
          accountId: "ext-123",
          accountName: "Test Account",
          accountAvatarUrl: null,
        },
      );

      expect(mockConnectedAccountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: "profile-1",
          platform: "X",
          accessToken: "new-token",
          refreshToken: "new-refresh",
          accountId: "ext-123",
          accountName: "Test Account",
          expiresAt: expect.any(Date),
        }),
      );
      expect(result).toEqual(mockAccount);
    });

    it("should handle create without refresh_token", async () => {
      mockConnectedAccountRepo.create.mockResolvedValue(mockAccount);

      await createConnectedAccount(
        "profile-1",
        "INSTAGRAM",
        {
          access_token: "new-token",
          expires_in: 7200,
        } as any,
        {
          accountId: "ext-456",
          accountName: "Test Account 2",
          accountAvatarUrl: null,
        },
      );

      expect(mockConnectedAccountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: "new-token",
          refreshToken: undefined,
        }),
      );
    });

    it("should handle create without expires_in", async () => {
      mockConnectedAccountRepo.create.mockResolvedValue(mockAccount);

      await createConnectedAccount(
        "profile-1",
        "X",
        {
          access_token: "new-token",
        } as any,
        {
          accountId: "ext-789",
          accountName: "Test Account 3",
          accountAvatarUrl: null,
        },
      );

      expect(mockConnectedAccountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: undefined,
        }),
      );
    });
  });

  describe("getValidAccessTokenByAccount", () => {
    it("should use repository findByProfileAndPlatform and then getValidAccessToken", async () => {
      mockConnectedAccountRepo.findByProfileAndPlatform.mockResolvedValue(mockAccount);
      // For the inner getValidAccessToken call
      mockConnectedAccountRepo.findById.mockResolvedValue(mockAccount);
      (isTokenExpired as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const token = await getValidAccessTokenByAccount("profile-1", "X" as any);

      expect(mockConnectedAccountRepo.findByProfileAndPlatform).toHaveBeenCalledWith(
        "profile-1",
        "X",
      );
      expect(token).toBe("plaintext-access-token");
    });

    it("should return null when no account found", async () => {
      mockConnectedAccountRepo.findByProfileAndPlatform.mockResolvedValue(null);

      const token = await getValidAccessTokenByAccount("profile-1", "X" as any);
      expect(token).toBeNull();
    });
  });

  describe("isAccountValid", () => {
    it("should return true for active, non-expired account", async () => {
      mockConnectedAccountRepo.findById.mockResolvedValue(mockAccount);

      const valid = await isAccountValid("ca-1");
      expect(valid).toBe(true);
    });

    it("should return false for inactive account", async () => {
      mockConnectedAccountRepo.findById.mockResolvedValue({
        ...mockAccount,
        isActive: false,
      });

      const valid = await isAccountValid("ca-1");
      expect(valid).toBe(false);
    });

    it("should return false when account not found", async () => {
      mockConnectedAccountRepo.findById.mockResolvedValue(null);

      const valid = await isAccountValid("nonexistent");
      expect(valid).toBe(false);
    });

    it("should try to refresh when account is expired with refreshToken", async () => {
      const expiredAccount = {
        ...mockAccount,
        expiresAt: new Date("2020-01-01"),
      };
      mockConnectedAccountRepo.findById.mockResolvedValue(expiredAccount);
      (refreshAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        access_token: "refreshed-token",
        refresh_token: "refreshed-refresh",
        expires_in: 3600,
      });

      const valid = await isAccountValid("ca-1");

      expect(valid).toBe(true);
      expect(mockConnectedAccountRepo.update).toHaveBeenCalled();
    });

    it("should return false when refresh fails in isAccountValid", async () => {
      const expiredAccount = {
        ...mockAccount,
        expiresAt: new Date("2020-01-01"),
      };
      mockConnectedAccountRepo.findById.mockResolvedValue(expiredAccount);
      (refreshAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Refresh failed"),
      );

      const valid = await isAccountValid("ca-1");
      expect(valid).toBe(false);
    });
  });

  describe("deactivateConnectedAccount / reactivateConnectedAccount", () => {
    it("should deactivate an account via repository update", async () => {
      mockConnectedAccountRepo.update.mockResolvedValue(mockAccount);

      await deactivateConnectedAccount("ca-1");

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith("ca-1", { isActive: false });
    });

    it("should reactivate an account via repository update", async () => {
      mockConnectedAccountRepo.update.mockResolvedValue(mockAccount);

      await reactivateConnectedAccount("ca-1");

      expect(mockConnectedAccountRepo.update).toHaveBeenCalledWith("ca-1", { isActive: true });
    });
  });
});
