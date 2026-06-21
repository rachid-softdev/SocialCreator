import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for PrismaProfileRepository
 *
 * Verifies:
 * - findById(id) — success (with connectedAccounts + agents includes), null, rejection
 * - findByUserId(userId) — success, empty, rejection
 * - create(data) — success, rejection
 * - update(id, data) — success, rejection
 * - delete(id) — success, rejection
 * - countByUserId(userId) — success, zero count, rejection
 */

// ── Mock prisma ─────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/infrastructure/cache", () => ({
  getCacheService: () => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
  }),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { PrismaProfileRepository } from "@/lib/repositories/profile.repository";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMockProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "profile-1",
    userId: "user-1",
    name: "My Profile",
    brandVoice: "Professional and friendly",
    contentBank: null,
    platforms: ["INSTAGRAM"],
    avatarUrl: null,
    isActive: true,
    teamId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    connectedAccounts: [
      {
        id: "ca-1",
        platform: "INSTAGRAM",
        accountName: "Test Account",
        isActive: true,
      },
    ],
    agents: [{ id: "ag-1", name: "Content Agent", isActive: true }],
    ...overrides,
  };
}

// ── Repository Instance ─────────────────────────────────────────────────────

const repo = new PrismaProfileRepository();

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PrismaProfileRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("returns profile with connectedAccounts and agents when found", async () => {
      const mockProfile = makeMockProfile({ id: "profile-1" });
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile as any);

      const result = await repo.findById("profile-1");

      expect(result).toEqual(mockProfile);
      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { id: "profile-1" },
        include: {
          connectedAccounts: {
            select: { id: true, platform: true, accountName: true, isActive: true },
          },
          agents: {
            select: { id: true, name: true, isActive: true },
          },
        },
      });
    });

    it("returns null when not found", async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(null as any);

      const result = await repo.findById("nonexistent");

      expect(result).toBeNull();
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.profile.findUnique).mockRejectedValue(new Error("DB error"));

      await expect(repo.findById("profile-1")).rejects.toThrow("DB error");
    });
  });

  describe("findByUserId", () => {
    it("returns profiles for user ordered by createdAt desc", async () => {
      const profiles = [
        makeMockProfile({ id: "profile-1", name: "Profile 1" }),
        makeMockProfile({ id: "profile-2", name: "Profile 2" }),
      ];
      vi.mocked(prisma.profile.findMany).mockResolvedValue(profiles as any);

      const result = await repo.findByUserId("user-1");

      expect(result).toHaveLength(2);
      expect(prisma.profile.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns empty array when user has no profiles", async () => {
      vi.mocked(prisma.profile.findMany).mockResolvedValue([] as any);

      const result = await repo.findByUserId("user-empty");

      expect(result).toStrictEqual([]);
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.profile.findMany).mockRejectedValue(new Error("DB error"));

      await expect(repo.findByUserId("user-1")).rejects.toThrow("DB error");
    });
  });

  describe("create", () => {
    it("creates a profile with all fields", async () => {
      const input = {
        userId: "user-1",
        name: "New Profile",
        brandVoice: "Bold and creative",
        contentBank: "bank-1",
        platforms: ["TIKTOK" as const],
        avatarUrl: "https://example.com/avatar.jpg",
        teamId: "team-1",
      };
      const mockProfile = makeMockProfile({
        id: "profile-new",
        ...input,
      });
      vi.mocked(prisma.profile.create).mockResolvedValue(mockProfile as any);

      const result = await repo.create(input);

      expect(result).toEqual(mockProfile);
      expect(prisma.profile.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          name: "New Profile",
          brandVoice: "Bold and creative",
          contentBank: "bank-1",
          platforms: ["TIKTOK"],
          avatarUrl: "https://example.com/avatar.jpg",
          teamId: "team-1",
        },
      });
    });

    it("defaults optional fields appropriately", async () => {
      const input = {
        userId: "user-2",
        name: "Minimal Profile",
        brandVoice: "Neutral",
      };
      const mockProfile = makeMockProfile({
        id: "profile-min",
        userId: "user-2",
        name: "Minimal Profile",
        brandVoice: "Neutral",
        contentBank: null,
        platforms: [],
        avatarUrl: null,
        teamId: null,
      });
      vi.mocked(prisma.profile.create).mockResolvedValue(mockProfile as any);

      const result = await repo.create(input);

      expect(result).toEqual(mockProfile);
      expect(prisma.profile.create).toHaveBeenCalledWith({
        data: {
          userId: "user-2",
          name: "Minimal Profile",
          brandVoice: "Neutral",
          contentBank: null,
          platforms: [],
          avatarUrl: null,
          teamId: null,
        },
      });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.profile.create).mockRejectedValue(new Error("DB error"));

      await expect(repo.create({ userId: "u1", name: "Fail", brandVoice: "N/A" })).rejects.toThrow(
        "DB error",
      );
    });
  });

  describe("update", () => {
    it("updates profile fields", async () => {
      const updateData = { name: "Updated Name", brandVoice: "Updated voice" };
      const updatedProfile = makeMockProfile({
        id: "profile-1",
        name: "Updated Name",
        brandVoice: "Updated voice",
      });
      vi.mocked(prisma.profile.update).mockResolvedValue(updatedProfile as any);

      const result = await repo.update("profile-1", updateData);

      expect(result).toEqual(updatedProfile);
      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { id: "profile-1" },
        data: updateData,
      });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.profile.update).mockRejectedValue(new Error("DB error"));

      await expect(repo.update("profile-1", { name: "Fail" })).rejects.toThrow("DB error");
    });
  });

  describe("delete", () => {
    it("deletes profile by id", async () => {
      vi.mocked(prisma.profile.delete).mockResolvedValue({} as any);

      await repo.delete("profile-1");

      expect(prisma.profile.delete).toHaveBeenCalledWith({ where: { id: "profile-1" } });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.profile.delete).mockRejectedValue(new Error("DB error"));

      await expect(repo.delete("nonexistent")).rejects.toThrow("DB error");
    });
  });

  describe("countByUserId", () => {
    it("returns count of profiles for a user", async () => {
      vi.mocked(prisma.profile.count).mockResolvedValue(3 as any);

      const result = await repo.countByUserId("user-1");

      expect(result).toBe(3);
      expect(prisma.profile.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    });

    it("returns zero when user has no profiles", async () => {
      vi.mocked(prisma.profile.count).mockResolvedValue(0 as any);

      const result = await repo.countByUserId("user-empty");

      expect(result).toBe(0);
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.profile.count).mockRejectedValue(new Error("DB error"));

      await expect(repo.countByUserId("user-1")).rejects.toThrow("DB error");
    });
  });
});
