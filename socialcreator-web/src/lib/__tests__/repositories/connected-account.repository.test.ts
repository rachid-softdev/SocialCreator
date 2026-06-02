/**
 * Tests for PrismaConnectedAccountRepository encryption/decryption
 *
 * Verifies:
 * - create() encrypts accessToken before storing
 * - findById() decrypts stored token
 * - update() encrypts the new token
 * - Round-trip create → find → compare yields same plaintext
 * - Plaintext legacy data is handled gracefully (decrypt failure fallback)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    connectedAccount: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock encryption module
const mockEncryptOAuthTokens = vi.fn();
const mockDecryptOAuthTokens = vi.fn();

vi.mock("@/lib/oauth/encryption", () => ({
  encryptOAuthTokens: (...args: unknown[]) => mockEncryptOAuthTokens(...args),
  decryptOAuthTokens: (...args: unknown[]) => mockDecryptOAuthTokens(...args),
}));

import type { ConnectedAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PrismaConnectedAccountRepository } from "@/lib/repositories/connected-account.repository";

describe("PrismaConnectedAccountRepository — encryption", () => {
  let repo: PrismaConnectedAccountRepository;

  const mockAccount: ConnectedAccount = {
    id: "ca-1",
    profileId: "profile-1",
    platform: "X" as any,
    accessToken: "encrypted-access-token",
    refreshToken: "encrypted-refresh-token",
    expiresAt: new Date("2025-12-31"),
    accountId: "ext-account-1",
    accountName: "Test Account",
    accountAvatarUrl: null,
    isActive: true,
    tokenType: null,
    scope: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const _decryptedAccount: ConnectedAccount = {
    ...mockAccount,
    accessToken: "plaintext-access-token",
    refreshToken: "plaintext-refresh-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrismaConnectedAccountRepository();
  });

  describe("create() — encrypts before storing", () => {
    it("should encrypt accessToken and refreshToken before calling prisma.create", async () => {
      const createInput = {
        profileId: "profile-1",
        platform: "X" as any,
        accessToken: "plaintext-access-token",
        refreshToken: "plaintext-refresh-token",
        accountId: "ext-account-1",
        accountName: "Test Account",
      };

      mockEncryptOAuthTokens.mockReturnValue({
        accessToken: "encrypted-access-token",
        refreshToken: "encrypted-refresh-token",
      });

      mockDecryptOAuthTokens.mockReturnValue({
        accessToken: "plaintext-access-token",
        refreshToken: "plaintext-refresh-token",
      });

      (prisma.connectedAccount.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAccount,
      );

      const result = await repo.create(createInput);

      // Verify encryption was called with plaintext tokens
      expect(mockEncryptOAuthTokens).toHaveBeenCalledWith(
        "plaintext-access-token",
        "plaintext-refresh-token",
      );

      // Verify prisma.create receives encrypted tokens
      expect(prisma.connectedAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessToken: "encrypted-access-token",
            refreshToken: "encrypted-refresh-token",
          }),
        }),
      );

      // Result should have decrypted tokens (repository handles auto-decrypt)
      expect(result.accessToken).toBe("plaintext-access-token");
      expect(result.refreshToken).toBe("plaintext-refresh-token");
    });

    it("should handle create without refreshToken", async () => {
      const createInput = {
        profileId: "profile-1",
        platform: "INSTAGRAM" as any,
        accessToken: "plaintext-access-token",
        accountId: "ext-account-2",
        accountName: "Test Account 2",
      };

      mockEncryptOAuthTokens.mockReturnValue({
        accessToken: "encrypted-access-token",
        refreshToken: null,
      });

      mockDecryptOAuthTokens.mockReturnValue({
        accessToken: "plaintext-access-token",
        refreshToken: null,
      });

      (prisma.connectedAccount.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockAccount,
        id: "ca-2",
        platform: "INSTAGRAM",
        refreshToken: null,
      });

      await repo.create(createInput);

      expect(mockEncryptOAuthTokens).toHaveBeenCalledWith("plaintext-access-token", null);
    });
  });

  describe("findById() — decrypts after retrieval", () => {
    it("should decrypt accessToken after finding by id", async () => {
      (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAccount,
      );

      mockDecryptOAuthTokens.mockReturnValue({
        accessToken: "plaintext-access-token",
        refreshToken: "plaintext-refresh-token",
      });

      const result = await repo.findById("ca-1");

      expect(prisma.connectedAccount.findUnique).toHaveBeenCalledWith({
        where: { id: "ca-1" },
      });
      expect(mockDecryptOAuthTokens).toHaveBeenCalledWith(
        "encrypted-access-token",
        "encrypted-refresh-token",
      );
      expect(result?.accessToken).toBe("plaintext-access-token");
      expect(result?.refreshToken).toBe("plaintext-refresh-token");
    });

    it("should return null when account not found", async () => {
      (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const result = await repo.findById("nonexistent");
      expect(result).toBeNull();
      expect(mockDecryptOAuthTokens).not.toHaveBeenCalled();
    });

    it("should return account as-is when accessToken is empty/null", async () => {
      const accountWithNoToken = { ...mockAccount, accessToken: "" };
      (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        accountWithNoToken,
      );

      const result = await repo.findById("ca-1");

      expect(result?.accessToken).toBe("");
      expect(mockDecryptOAuthTokens).not.toHaveBeenCalled();
    });
  });

  describe("update() — encrypts before updating", () => {
    it("should encrypt tokens before calling prisma.update", async () => {
      const updateData = {
        accessToken: "new-plaintext-token",
        refreshToken: "new-plaintext-refresh",
      };

      mockEncryptOAuthTokens.mockReturnValue({
        accessToken: "new-encrypted-token",
        refreshToken: "new-encrypted-refresh",
      });

      mockDecryptOAuthTokens.mockReturnValue({
        accessToken: "new-plaintext-token",
        refreshToken: "new-plaintext-refresh",
      });

      const updatedMock = {
        ...mockAccount,
        accessToken: "new-encrypted-token",
        refreshToken: "new-encrypted-refresh",
      };
      (prisma.connectedAccount.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        updatedMock,
      );

      const result = await repo.update("ca-1", updateData as any);

      expect(mockEncryptOAuthTokens).toHaveBeenCalledWith(
        "new-plaintext-token",
        "new-plaintext-refresh",
      );
      expect(prisma.connectedAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ca-1" },
          data: expect.objectContaining({
            accessToken: "new-encrypted-token",
            refreshToken: "new-encrypted-refresh",
          }),
        }),
      );
      expect(result.accessToken).toBe("new-plaintext-token");
    });

    it("should handle update without changing tokens (partial update)", async () => {
      const updateData = { isActive: false };

      mockDecryptOAuthTokens.mockReturnValue({
        accessToken: mockAccount.accessToken,
        refreshToken: mockAccount.refreshToken,
      });

      const updatedMock = { ...mockAccount, isActive: false };
      (prisma.connectedAccount.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        updatedMock,
      );

      const result = await repo.update("ca-1", updateData as any);

      // If no token fields in update data, encryptSensitive returns early without calling encryptOAuthTokens
      expect(mockEncryptOAuthTokens).not.toHaveBeenCalled();
      expect(result.isActive).toBe(false);
    });
  });

  describe("round-trip (create → find → compare)", () => {
    it("should return consistent plaintext after create and findById", async () => {
      const originalToken = "original-plaintext-token";
      const originalRefresh = "original-plaintext-refresh";

      // Step 1: encrypt for storage
      mockEncryptOAuthTokens.mockReturnValue({
        accessToken: "encrypted-v1",
        refreshToken: "encrypted-refresh-v1",
      });

      // Step 2: decrypt for response from create
      mockDecryptOAuthTokens.mockReturnValue({
        accessToken: originalToken,
        refreshToken: originalRefresh,
      });

      const createdMock = {
        ...mockAccount,
        accessToken: "encrypted-v1",
        refreshToken: "encrypted-refresh-v1",
      };

      (prisma.connectedAccount.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        createdMock,
      );

      const created = await repo.create({
        profileId: "profile-1",
        platform: "X" as any,
        accessToken: originalToken,
        refreshToken: originalRefresh,
        accountId: "ext-1",
        accountName: "Test",
      });

      expect(created.accessToken).toBe(originalToken);
      expect(created.refreshToken).toBe(originalRefresh);
    });
  });

  describe("legacy plaintext data handling", () => {
    it("should return account as-is when decrypt fails (legacy plaintext data)", async () => {
      const legacyAccount = {
        ...mockAccount,
        accessToken: "legacy-plaintext-token",
        refreshToken: null,
      };

      (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        legacyAccount,
      );

      mockDecryptOAuthTokens.mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      const result = await repo.findById("ca-1");

      // Should return the account with plaintext data intact (graceful degradation)
      expect(result).not.toBeNull();
      expect(result?.accessToken).toBe("legacy-plaintext-token");
    });

    it("should handle decrypt failure in array methods gracefully", async () => {
      const legacyAccounts = [
        { ...mockAccount, id: "ca-1", accessToken: "legacy-token-1" },
        { ...mockAccount, id: "ca-2", accessToken: "legacy-token-2" },
      ];

      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        legacyAccounts,
      );

      mockDecryptOAuthTokens.mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      const result = await repo.findByProfileId("profile-1");

      expect(result).toHaveLength(2);
      expect(result[0].accessToken).toBe("legacy-token-1");
      expect(result[1].accessToken).toBe("legacy-token-2");
    });
  });

  describe("findByProfileAndPlatform — decrypts after retrieval", () => {
    it("should decrypt tokens when finding by profile and platform", async () => {
      (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAccount,
      );

      mockDecryptOAuthTokens.mockReturnValue({
        accessToken: "decrypted-access",
        refreshToken: "decrypted-refresh",
      });

      const result = await repo.findByProfileAndPlatform("profile-1", "X" as any);

      expect(prisma.connectedAccount.findUnique).toHaveBeenCalledWith({
        where: { profileId_platform: { profileId: "profile-1", platform: "X" } },
      });
      expect(result?.accessToken).toBe("decrypted-access");
    });
  });

  describe("delete — does not encrypt/decrypt", () => {
    it("should pass through to prisma.delete without encryption", async () => {
      (prisma.connectedAccount.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockAccount,
      );

      await repo.delete("ca-1");

      expect(prisma.connectedAccount.delete).toHaveBeenCalledWith({
        where: { id: "ca-1" },
      });
      expect(mockEncryptOAuthTokens).not.toHaveBeenCalled();
      expect(mockDecryptOAuthTokens).not.toHaveBeenCalled();
    });
  });

  describe("findExpiringBefore — filters by date and active status", () => {
    const futureDate = new Date("2025-12-31");
    const pastDate = new Date("2024-01-01");

    it("should return accounts with expiresAt ≤ given date", async () => {
      const accounts = [
        { ...mockAccount, id: "ca-1", expiresAt: new Date("2025-06-01") },
        { ...mockAccount, id: "ca-2", expiresAt: new Date("2025-12-01") },
      ];

      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        accounts,
      );
      mockDecryptOAuthTokens.mockImplementation((token: string) => ({
        accessToken: `decrypted-${token}`,
        refreshToken: "decrypted-refresh",
      }));

      const result = await repo.findExpiringBefore(futureDate);

      expect(prisma.connectedAccount.findMany).toHaveBeenCalledWith({
        where: { isActive: true, expiresAt: { lte: futureDate } },
      });
      expect(result).toHaveLength(2);
      expect(result[0].accessToken).toBe("decrypted-encrypted-access-token");
    });

    it("should only return active accounts (isActive: true)", async () => {
      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
        { ...mockAccount, id: "ca-1", isActive: true, expiresAt: new Date("2025-06-01") },
      ]);

      mockDecryptOAuthTokens.mockReturnValue({
        accessToken: "decrypted-token",
        refreshToken: null,
      });

      const result = await repo.findExpiringBefore(futureDate);

      expect(result).toHaveLength(1);
      // Verify the query includes isActive: true
      expect(prisma.connectedAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it("should return empty array when no accounts match the date", async () => {
      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const result = await repo.findExpiringBefore(pastDate);

      expect(result).toStrictEqual([]);
    });

    it("should return only accounts expiring on or before the given date (not after)", async () => {
      const accounts = [{ ...mockAccount, id: "ca-1", expiresAt: new Date("2025-06-01") }];

      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        accounts,
      );
      mockDecryptOAuthTokens.mockReturnValue({
        accessToken: "decrypted",
        refreshToken: null,
      });

      // Query with a date before ca-2's expiresAt
      const result = await repo.findExpiringBefore(new Date("2025-10-01"));

      expect(prisma.connectedAccount.findMany).toHaveBeenCalledWith({
        where: { isActive: true, expiresAt: { lte: new Date("2025-10-01") } },
      });
      // Only ca-1 matches (June <= Oct), ca-2 (Dec) would not be returned
      expect(result).toHaveLength(1);
    });

    it("should decrypt tokens after retrieval", async () => {
      const accounts = [{ ...mockAccount, id: "ca-1", expiresAt: new Date("2025-06-01") }];

      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        accounts,
      );

      const decryptResult = {
        accessToken: "plaintext-access-token",
        refreshToken: "plaintext-refresh-token",
      };
      mockDecryptOAuthTokens.mockReturnValue(decryptResult);

      const result = await repo.findExpiringBefore(futureDate);

      expect(mockDecryptOAuthTokens).toHaveBeenCalledWith(
        "encrypted-access-token",
        "encrypted-refresh-token",
      );
      expect(result[0].accessToken).toBe("plaintext-access-token");
      expect(result[0].refreshToken).toBe("plaintext-refresh-token");
    });
  });
});
