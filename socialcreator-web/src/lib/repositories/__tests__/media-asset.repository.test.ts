import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for PrismaMediaAssetRepository
 *
 * Verifies:
 * - findById(id) — success, null, rejection
 * - findByProfileId(profileId) — without type filter, with type filter, rejection
 * - create(data) — success, rejection
 * - delete(id) — success, rejection
 */

// ── Mock prisma ─────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mediaAsset: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { PrismaMediaAssetRepository } from "@/lib/repositories/media-asset.repository";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMockMediaAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: "media-1",
    profileId: "profile-1",
    type: "IMAGE",
    url: "https://example.com/image.jpg",
    filename: "image.jpg",
    mimeType: "image/jpeg",
    size: 1024,
    width: 800,
    height: 600,
    duration: null,
    uploadedAt: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// ── Repository Instance ─────────────────────────────────────────────────────

const repo = new PrismaMediaAssetRepository();

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PrismaMediaAssetRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("returns media asset when found", async () => {
      const mockAsset = makeMockMediaAsset({ id: "media-1" });
      vi.mocked(prisma.mediaAsset.findUnique).mockResolvedValue(mockAsset as any);

      const result = await repo.findById("media-1");

      expect(result).toEqual(mockAsset);
      expect(prisma.mediaAsset.findUnique).toHaveBeenCalledWith({ where: { id: "media-1" } });
    });

    it("returns null when not found", async () => {
      vi.mocked(prisma.mediaAsset.findUnique).mockResolvedValue(null as any);

      const result = await repo.findById("nonexistent");

      expect(result).toBeNull();
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.mediaAsset.findUnique).mockRejectedValue(new Error("DB error"));

      await expect(repo.findById("1")).rejects.toThrow("DB error");
    });
  });

  describe("findByProfileId", () => {
    it("returns assets for a profile without type filter", async () => {
      const assets = [
        makeMockMediaAsset({ id: "media-1", type: "IMAGE" }),
        makeMockMediaAsset({ id: "media-2", type: "VIDEO" }),
      ];
      vi.mocked(prisma.mediaAsset.findMany).mockResolvedValue(assets as any);

      const result = await repo.findByProfileId("profile-1");

      expect(result).toEqual(assets);
      expect(result).toHaveLength(2);
      expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith({
        where: { profileId: "profile-1" },
        orderBy: { uploadedAt: "desc" },
      });
    });

    it("returns assets for a profile filtered by type", async () => {
      const assets = [makeMockMediaAsset({ id: "media-1", type: "VIDEO" })];
      vi.mocked(prisma.mediaAsset.findMany).mockResolvedValue(assets as any);

      const result = await repo.findByProfileId("profile-1", "VIDEO");

      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("VIDEO");
      expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith({
        where: { profileId: "profile-1", type: "VIDEO" },
        orderBy: { uploadedAt: "desc" },
      });
    });

    it("returns empty array when profile has no assets", async () => {
      vi.mocked(prisma.mediaAsset.findMany).mockResolvedValue([] as any);

      const result = await repo.findByProfileId("profile-empty");

      expect(result).toStrictEqual([]);
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.mediaAsset.findMany).mockRejectedValue(new Error("DB error"));

      await expect(repo.findByProfileId("profile-1")).rejects.toThrow("DB error");
    });
  });

  describe("create", () => {
    it("creates a media asset with all fields", async () => {
      const input = {
        profileId: "profile-1",
        type: "IMAGE" as const,
        url: "https://example.com/new.jpg",
        filename: "new.jpg",
        mimeType: "image/jpeg",
        size: 2048,
        width: 1920,
        height: 1080,
        duration: undefined,
      };
      const mockAsset = makeMockMediaAsset({
        id: "media-new",
        ...input,
        duration: null,
      });
      vi.mocked(prisma.mediaAsset.create).mockResolvedValue(mockAsset as any);

      const result = await repo.create(input);

      expect(result).toEqual(mockAsset);
      expect(prisma.mediaAsset.create).toHaveBeenCalledWith({
        data: {
          profileId: "profile-1",
          type: "IMAGE",
          url: "https://example.com/new.jpg",
          filename: "new.jpg",
          mimeType: "image/jpeg",
          size: 2048,
          width: 1920,
          height: 1080,
          duration: null,
        },
      });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.mediaAsset.create).mockRejectedValue(new Error("DB error"));

      await expect(
        repo.create({
          profileId: "p1",
          type: "IMAGE" as const,
          url: "https://example.com/fail.jpg",
        }),
      ).rejects.toThrow("DB error");
    });
  });

  describe("delete", () => {
    it("deletes media asset by id", async () => {
      vi.mocked(prisma.mediaAsset.delete).mockResolvedValue({} as any);

      await repo.delete("media-1");

      expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: "media-1" } });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.mediaAsset.delete).mockRejectedValue(new Error("DB error"));

      await expect(repo.delete("nonexistent")).rejects.toThrow("DB error");
    });
  });
});
