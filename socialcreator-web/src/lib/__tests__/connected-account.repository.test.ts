/**
 * Tests for PrismaConnectedAccountRepository
 *
 * Verifies:
 * - findExpiringBefore() returns accounts with expiresAt ≤ given date
 * - findExpiringBefore() only returns active accounts (isActive: true)
 * - Empty result when no accounts match
 * - Token decryption is applied to returned accounts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock prisma ─────────────────────────────────────────────────────────────

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

// Mock encryption so we can test decryption behavior
vi.mock("@/lib/oauth/encryption", () => ({
  encryptOAuthTokens: vi.fn((accessToken: string, refreshToken: string | null) => ({
    accessToken: `encrypted-${accessToken}`,
    refreshToken: refreshToken ? `encrypted-${refreshToken}` : null,
  })),
  decryptOAuthTokens: vi.fn((accessToken: string, refreshToken: string | null) => ({
    accessToken: accessToken.replace("encrypted-", ""),
    refreshToken: refreshToken ? refreshToken.replace("encrypted-", "") : null,
  })),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { PrismaConnectedAccountRepository } from "@/lib/repositories/connected-account.repository";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMockConnectedAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "ca-1",
    profileId: "profile-1",
    platform: "INSTAGRAM",
    accessToken: "encrypted-real-access-token",
    refreshToken: "encrypted-real-refresh-token",
    expiresAt: new Date("2025-06-15T12:00:00.000Z"),
    isActive: true,
    accountId: "ext-123",
    accountName: "Test Account",
    accountAvatarUrl: null,
    tokenType: null,
    scope: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// ── Repository Instance ─────────────────────────────────────────────────────

const repo = new PrismaConnectedAccountRepository();

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PrismaConnectedAccountRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findExpiringBefore", () => {
    it("should return accounts with expiresAt ≤ given date", async () => {
      const cutoffDate = new Date("2025-07-01T00:00:00.000Z");
      const accounts = [
        makeMockConnectedAccount({ id: "ca-1", expiresAt: new Date("2025-06-01") }),
        makeMockConnectedAccount({ id: "ca-2", expiresAt: new Date("2025-06-15") }),
        makeMockConnectedAccount({ id: "ca-3", expiresAt: new Date("2025-06-30") }),
      ];

      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        accounts,
      );

      const result = await repo.findExpiringBefore(cutoffDate);

      // Verify Prisma was called with correct filter
      expect(prisma.connectedAccount.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          expiresAt: { lte: cutoffDate },
        },
      });

      // Verify all 3 accounts returned
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("ca-1");
      expect(result[1].id).toBe("ca-2");
      expect(result[2].id).toBe("ca-3");
    });

    it("should filter by isActive: true", async () => {
      const cutoffDate = new Date("2025-07-01T00:00:00.000Z");
      const activeAccount = makeMockConnectedAccount({
        id: "ca-active",
        isActive: true,
        expiresAt: new Date("2025-06-01"),
      });

      // Only return active account — inactive ones are filtered in the Prisma query
      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
        activeAccount,
      ]);

      const result = await repo.findExpiringBefore(cutoffDate);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ca-active");

      // Verify isActive: true was passed to Prisma
      expect(prisma.connectedAccount.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          expiresAt: { lte: cutoffDate },
        },
      });
    });

    it("should return empty array when no accounts match", async () => {
      const cutoffDate = new Date("2025-01-01T00:00:00.000Z");

      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const result = await repo.findExpiringBefore(cutoffDate);

      expect(result).toStrictEqual([]);
      expect(prisma.connectedAccount.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          expiresAt: { lte: cutoffDate },
        },
      });
    });

    it("should return empty array when no accounts are expiring before the date", async () => {
      // All accounts have expiresAt far in the future
      const cutoffDate = new Date("2025-01-01T00:00:00.000Z");
      const _futureAccount = makeMockConnectedAccount({
        expiresAt: new Date("2099-12-31"),
      });

      // Simulate: Prisma correctly filters and returns nothing
      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const result = await repo.findExpiringBefore(cutoffDate);

      expect(result).toStrictEqual([]);
    });

    it("should decrypt tokens on returned accounts", async () => {
      const cutoffDate = new Date("2025-07-01T00:00:00.000Z");
      const accounts = [
        makeMockConnectedAccount({
          id: "ca-1",
          accessToken: "encrypted-my-access-token",
          refreshToken: "encrypted-my-refresh-token",
        }),
      ];

      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        accounts,
      );

      const result = await repo.findExpiringBefore(cutoffDate);

      // Tokens should be decrypted (the mock strips "encrypted-" prefix)
      expect(result[0].accessToken).toBe("my-access-token");
      expect(result[0].refreshToken).toBe("my-refresh-token");
    });

    it("should handle account without refreshToken", async () => {
      const cutoffDate = new Date("2025-07-01T00:00:00.000Z");
      const accounts = [
        makeMockConnectedAccount({
          id: "ca-no-refresh",
          accessToken: "encrypted-token",
          refreshToken: null,
        }),
      ];

      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        accounts,
      );

      const result = await repo.findExpiringBefore(cutoffDate);

      expect(result).toHaveLength(1);
      expect(result[0].accessToken).toBe("token");
      expect(result[0].refreshToken).toBeNull();
    });

    it("should handle accounts with exact cutoff date match", async () => {
      const cutoffDate = new Date("2025-06-15T12:00:00.000Z");
      const exactMatch = makeMockConnectedAccount({
        id: "ca-exact",
        expiresAt: new Date("2025-06-15T12:00:00.000Z"),
      });

      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
        exactMatch,
      ]);

      const result = await repo.findExpiringBefore(cutoffDate);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ca-exact");

      // Verify lte (less than or equal) is used
      expect(prisma.connectedAccount.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          expiresAt: { lte: cutoffDate },
        },
      });
    });
  });

  describe("findById", () => {
    it("should find account by id with decrypted tokens", async () => {
      const account = makeMockConnectedAccount({
        id: "ca-specific",
        accessToken: "encrypted-secret-token",
      });

      (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        account,
      );

      const result = await repo.findById("ca-specific");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("ca-specific");
      expect(result?.accessToken).toBe("secret-token");
      expect(prisma.connectedAccount.findUnique).toHaveBeenCalledWith({
        where: { id: "ca-specific" },
      });
    });

    it("should return null when account not found", async () => {
      (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const result = await repo.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByProfileId", () => {
    it("should return accounts for a profile with decrypted tokens", async () => {
      const accounts = [
        makeMockConnectedAccount({
          id: "ca-1",
          accessToken: "encrypted-token-a",
        }),
        makeMockConnectedAccount({
          id: "ca-2",
          accessToken: "encrypted-token-b",
        }),
      ];

      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        accounts,
      );

      const result = await repo.findByProfileId("profile-1");

      expect(result).toHaveLength(2);
      expect(result[0].accessToken).toBe("token-a");
      expect(result[1].accessToken).toBe("token-b");
      expect(prisma.connectedAccount.findMany).toHaveBeenCalledWith({
        where: { profileId: "profile-1" },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should return empty array when profile has no accounts", async () => {
      (prisma.connectedAccount.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const result = await repo.findByProfileId("profile-empty");

      expect(result).toStrictEqual([]);
    });
  });

  describe("findByProfileAndPlatform", () => {
    it("should find account by profileId and platform", async () => {
      const account = makeMockConnectedAccount({
        accessToken: "encrypted-platform-token",
      });

      (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        account,
      );

      const result = await repo.findByProfileAndPlatform("profile-1", "INSTAGRAM");

      expect(result).not.toBeNull();
      expect(result?.accessToken).toBe("platform-token");
      expect(prisma.connectedAccount.findUnique).toHaveBeenCalledWith({
        where: { profileId_platform: { profileId: "profile-1", platform: "INSTAGRAM" } },
      });
    });

    it("should return null when no account for that platform", async () => {
      (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const result = await repo.findByProfileAndPlatform("profile-1", "TIKTOK");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("should encrypt tokens before saving", async () => {
      const input = {
        profileId: "profile-1",
        platform: "INSTAGRAM" as any,
        accessToken: "plain-access-token",
        refreshToken: "plain-refresh-token",
        expiresAt: new Date("2025-12-31"),
        accountId: "ext-123",
        accountName: "Test",
        accountAvatarUrl: undefined,
      };

      const savedAccount = makeMockConnectedAccount({
        accessToken: "encrypted-plain-access-token",
        refreshToken: "encrypted-plain-refresh-token",
      });

      (prisma.connectedAccount.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        savedAccount,
      );

      const result = await repo.create(input);

      expect(prisma.connectedAccount.create).toHaveBeenCalled();
      // Result should have decrypted tokens
      expect(result.accessToken).toBe("plain-access-token");
    });

    it("should handle create without refreshToken", async () => {
      const input = {
        profileId: "profile-1",
        platform: "X" as any,
        accessToken: "token-only",
        accountId: "ext-456",
        accountName: "X Account",
      };

      const savedAccount = makeMockConnectedAccount({
        platform: "X",
        accessToken: "encrypted-token-only",
        refreshToken: null,
      });

      (prisma.connectedAccount.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        savedAccount,
      );

      const result = await repo.create(input as any);

      expect(result.accessToken).toBe("token-only");
      expect(result.refreshToken).toBeNull();
    });
  });

  describe("update", () => {
    it("should update and return decrypted account", async () => {
      const updatedAccount = makeMockConnectedAccount({
        accessToken: "encrypted-new-token",
        refreshToken: "encrypted-new-refresh",
      });

      (prisma.connectedAccount.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        updatedAccount,
      );

      const result = await repo.update("ca-1", {
        accessToken: "new-token",
      } as any);

      expect(result.accessToken).toBe("new-token");
      expect(prisma.connectedAccount.update).toHaveBeenCalledWith({
        where: { id: "ca-1" },
        data: expect.any(Object),
      });
    });
  });

  describe("delete", () => {
    it("should delete account by id", async () => {
      (prisma.connectedAccount.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        {} as any,
      );

      await repo.delete("ca-1");

      expect(prisma.connectedAccount.delete).toHaveBeenCalledWith({
        where: { id: "ca-1" },
      });
    });
  });
});
