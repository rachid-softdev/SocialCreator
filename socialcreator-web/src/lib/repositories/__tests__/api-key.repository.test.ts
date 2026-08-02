import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for PrismaApiKeyRepository
 *
 * Verifies:
 * - findById(id) — success, null, rejection
 * - findByUserId(userId) — filters where revokedAt:null, rejection
 * - findByKeyHash(keyHash) — success, null, rejection
 * - create(data) — success, rejection
 * - revoke(id) — sets revokedAt to current date, rejection
 * - updateLastUsed(id) — sets lastUsed to current date, rejection
 */

// ── Mock prisma ─────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { PrismaApiKeyRepository } from "@/lib/repositories/api-key.repository";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMockApiKey(overrides: Record<string, unknown> = {}) {
  return {
    id: "ak-1",
    userId: "user-1",
    name: "My API Key",
    keyHash: "hashed-key-abc123",
    prefix: "sc_abc",
    expiresAt: null,
    revokedAt: null,
    lastUsed: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// ── Repository Instance ─────────────────────────────────────────────────────

const repo = new PrismaApiKeyRepository();

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PrismaApiKeyRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("returns API key when found", async () => {
      const mockKey = makeMockApiKey({ id: "ak-1" });
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(mockKey as any);

      const result = await repo.findById("ak-1");

      expect(result).toEqual(mockKey);
      expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({ where: { id: "ak-1" } });
    });

    it("returns null when not found", async () => {
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null as any);

      const result = await repo.findById("nonexistent");

      expect(result).toBeNull();
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.apiKey.findUnique).mockRejectedValue(new Error("DB error"));

      await expect(repo.findById("ak-1")).rejects.toThrow("DB error");
    });
  });

  describe("findByUserId", () => {
    it("returns non-revoked keys for user ordered by createdAt desc", async () => {
      const keys = [
        makeMockApiKey({ id: "ak-1", name: "Key 1" }),
        makeMockApiKey({ id: "ak-2", name: "Key 2" }),
      ];
      vi.mocked(prisma.apiKey.findMany).mockResolvedValue(keys as any);

      const result = await repo.findByUserId("user-1");

      expect(result).toHaveLength(2);
      expect(prisma.apiKey.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", revokedAt: null },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns empty array when user has no keys", async () => {
      vi.mocked(prisma.apiKey.findMany).mockResolvedValue([] as any);

      const result = await repo.findByUserId("user-empty");

      expect(result).toStrictEqual([]);
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.apiKey.findMany).mockRejectedValue(new Error("DB error"));

      await expect(repo.findByUserId("user-1")).rejects.toThrow("DB error");
    });
  });

  describe("findByKeyHash", () => {
    it("returns key when hash matches", async () => {
      const mockKey = makeMockApiKey({ keyHash: "hashed-key-abc123" });
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(mockKey as any);

      const result = await repo.findByKeyHash("hashed-key-abc123");

      expect(result).toEqual(mockKey);
      expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { keyHash: "hashed-key-abc123" },
      });
    });

    it("returns null when hash does not match", async () => {
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null as any);

      const result = await repo.findByKeyHash("nonexistent-hash");

      expect(result).toBeNull();
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.apiKey.findUnique).mockRejectedValue(new Error("DB error"));

      await expect(repo.findByKeyHash("hash")).rejects.toThrow("DB error");
    });
  });

  describe("create", () => {
    it("creates an API key with all fields", async () => {
      const input = {
        userId: "user-1",
        name: "New Key",
        keyHash: "hashed-new-key",
        prefix: "sc_new",
        expiresAt: new Date("2025-12-31"),
      };
      const mockKey = makeMockApiKey({
        id: "ak-new",
        ...input,
      });
      vi.mocked(prisma.apiKey.create).mockResolvedValue(mockKey as any);

      const result = await repo.create(input);

      expect(result).toEqual(mockKey);
      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          name: "New Key",
          keyHash: "hashed-new-key",
          prefix: "sc_new",
          expiresAt: input.expiresAt,
        },
      });
    });

    it("defaults expiresAt to null when not provided", async () => {
      const input = {
        userId: "user-1",
        name: "No Expiry Key",
        keyHash: "hash-no-expiry",
        prefix: "sc_noe",
      };
      const mockKey = makeMockApiKey({
        id: "ak-noexp",
        name: "No Expiry Key",
        keyHash: "hash-no-expiry",
        prefix: "sc_noe",
        expiresAt: null,
      });
      vi.mocked(prisma.apiKey.create).mockResolvedValue(mockKey as any);

      const result = await repo.create(input);

      expect(result).toEqual(mockKey);
      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          name: "No Expiry Key",
          keyHash: "hash-no-expiry",
          prefix: "sc_noe",
          expiresAt: null,
        },
      });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.apiKey.create).mockRejectedValue(new Error("DB error"));

      await expect(
        repo.create({ userId: "u1", name: "Fail", keyHash: "hash", prefix: "sc_f" }),
      ).rejects.toThrow("DB error");
    });
  });

  describe("revoke", () => {
    it("sets revokedAt to current date", async () => {
      const before = new Date();
      const revokedKey = makeMockApiKey({ id: "ak-1", revokedAt: new Date() });
      vi.mocked(prisma.apiKey.update).mockResolvedValue(revokedKey as any);

      const result = await repo.revoke("ak-1");

      expect(result.revokedAt).toBeInstanceOf(Date);
      const callArgs = vi.mocked(prisma.apiKey.update).mock.calls[0]![0];
      expect(callArgs.where).toEqual({ id: "ak-1" });
      expect(callArgs.data.revokedAt).toBeInstanceOf(Date);
      const calledAt = new Date((callArgs as any).data.revokedAt);
      expect(calledAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.apiKey.update).mockRejectedValue(new Error("DB error"));

      await expect(repo.revoke("ak-1")).rejects.toThrow("DB error");
    });
  });

  describe("updateLastUsed", () => {
    it("sets lastUsed to current date", async () => {
      const before = new Date();
      const updatedKey = makeMockApiKey({ id: "ak-1", lastUsed: new Date() });
      vi.mocked(prisma.apiKey.update).mockResolvedValue(updatedKey as any);

      await repo.updateLastUsed("ak-1");

      const callArgs = vi.mocked(prisma.apiKey.update).mock.calls[0]![0];
      expect(callArgs.where).toEqual({ id: "ak-1" });
      expect(callArgs.data.lastUsed).toBeInstanceOf(Date);
      const calledAt = new Date((callArgs as any).data.lastUsed);
      expect(calledAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.apiKey.update).mockRejectedValue(new Error("DB error"));

      await expect(repo.updateLastUsed("ak-1")).rejects.toThrow("DB error");
    });
  });
});
