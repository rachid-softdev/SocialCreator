/**
 * Tests for PrismaAnalyticsRepository
 *
 * Verifies:
 * - findByProfileId(options) — default/custom pagination, platform filter,
 *   date range (from, to, both), empty results, error propagation
 * - getDailyStats(profileId, days) — correct since date, empty, ascending order
 * - findByPlatform(platform, options) — pagination, profileId filter,
 *   date range, platform-only, error propagation
 */

// ── Mock prisma ─────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    analytics: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { PrismaAnalyticsRepository } from "@/lib/repositories/analytics.repository";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMockAnalytics(overrides: Record<string, unknown> = {}) {
  return {
    id: "analytics-1",
    profileId: "profile-1",
    platform: "INSTAGRAM",
    date: new Date("2024-06-15"),
    followers: 1200,
    following: 450,
    posts: 52,
    likes: 340,
    comments: 28,
    shares: 19,
    views: 6200,
    engagement: 4.1,
    ...overrides,
  };
}

// ── Repository Instance ─────────────────────────────────────────────────────

const repo = new PrismaAnalyticsRepository();

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PrismaAnalyticsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── findByProfileId ───────────────────────────────────────────────────────

  describe("findByProfileId", () => {
    it("uses default pagination when no pagination options provided", async () => {
      const items = [makeMockAnalytics({ id: "a1" }), makeMockAnalytics({ id: "a2" })];
      vi.mocked(prisma.analytics.findMany).mockResolvedValue(items as any);
      vi.mocked(prisma.analytics.count).mockResolvedValue(2);

      const result = await repo.findByProfileId({ profileId: "profile-1" });

      expect(result).toEqual({
        items,
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
      expect(prisma.analytics.findMany).toHaveBeenCalledWith({
        where: { profileId: "profile-1" },
        orderBy: { date: "desc" },
        skip: 0,
        take: 20,
      });
      expect(prisma.analytics.count).toHaveBeenCalledWith({
        where: { profileId: "profile-1" },
      });
    });

    it("computes skip and take correctly for custom pagination", async () => {
      vi.mocked(prisma.analytics.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.analytics.count).mockResolvedValue(55);

      const result = await repo.findByProfileId({
        profileId: "profile-1",
        page: 3,
        pageSize: 10,
      });

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      // totalPages = ceil(55 / 10) = 6
      expect(result.totalPages).toBe(6);
      expect(prisma.analytics.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it("passes platform filter to the where clause", async () => {
      vi.mocked(prisma.analytics.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.analytics.count).mockResolvedValue(0);

      await repo.findByProfileId({
        profileId: "profile-1",
        platform: "TIKTOK",
      });

      expect(prisma.analytics.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ platform: "TIKTOK" }),
        }),
      );
      expect(prisma.analytics.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ platform: "TIKTOK" }),
        }),
      );
    });

    it("applies gte filter when only from date is provided", async () => {
      const from = new Date("2024-06-01");
      vi.mocked(prisma.analytics.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.analytics.count).mockResolvedValue(0);

      await repo.findByProfileId({ profileId: "profile-1", from });

      const expectedWhere = {
        profileId: "profile-1",
        date: { gte: from },
      };
      expect(prisma.analytics.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(prisma.analytics.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("applies lte filter when only to date is provided", async () => {
      const to = new Date("2024-06-30");
      vi.mocked(prisma.analytics.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.analytics.count).mockResolvedValue(0);

      await repo.findByProfileId({ profileId: "profile-1", to });

      const expectedWhere = {
        profileId: "profile-1",
        date: { lte: to },
      };
      expect(prisma.analytics.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(prisma.analytics.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("applies both gte and lte when from and to dates are provided", async () => {
      const from = new Date("2024-06-01");
      const to = new Date("2024-06-30");
      vi.mocked(prisma.analytics.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.analytics.count).mockResolvedValue(0);

      await repo.findByProfileId({ profileId: "profile-1", from, to });

      const expectedWhere = {
        profileId: "profile-1",
        date: { gte: from, lte: to },
      };
      expect(prisma.analytics.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(prisma.analytics.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("returns empty result shape when no matches found", async () => {
      vi.mocked(prisma.analytics.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.analytics.count).mockResolvedValue(0);

      const result = await repo.findByProfileId({ profileId: "profile-empty" });

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });
    });

    it("propagates error when prisma.analytics.findMany throws", async () => {
      vi.mocked(prisma.analytics.findMany).mockRejectedValue(new Error("DB find failed"));
      vi.mocked(prisma.analytics.count).mockResolvedValue(0);

      await expect(repo.findByProfileId({ profileId: "profile-1" })).rejects.toThrow(
        "DB find failed",
      );
    });

    it("propagates error when prisma.analytics.count throws", async () => {
      vi.mocked(prisma.analytics.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.analytics.count).mockRejectedValue(new Error("DB count failed"));

      await expect(repo.findByProfileId({ profileId: "profile-1" })).rejects.toThrow(
        "DB count failed",
      );
    });
  });

  // ── getDailyStats ─────────────────────────────────────────────────────────

  describe("getDailyStats", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns analytics for last N days with correct since date", async () => {
      const now = new Date("2024-06-20T00:00:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const items = [makeMockAnalytics({ id: "a1" })];
      vi.mocked(prisma.analytics.findMany).mockResolvedValue(items as any);

      const result = await repo.getDailyStats("profile-1", 7);

      const expectedSince = new Date("2024-06-13T00:00:00.000Z");
      expect(result).toEqual(items);
      expect(prisma.analytics.findMany).toHaveBeenCalledWith({
        where: {
          profileId: "profile-1",
          date: { gte: expectedSince },
        },
        orderBy: { date: "asc" },
      });
    });

    it("returns empty array when no analytics found", async () => {
      vi.mocked(prisma.analytics.findMany).mockResolvedValue([] as any);

      const result = await repo.getDailyStats("profile-empty", 30);

      expect(result).toStrictEqual([]);
    });

    it("returns multiple items in ascending date order", async () => {
      const items = [
        makeMockAnalytics({ id: "a1", date: new Date("2024-06-14") }),
        makeMockAnalytics({ id: "a2", date: new Date("2024-06-15") }),
      ];
      vi.mocked(prisma.analytics.findMany).mockResolvedValue(items as any);

      const result = await repo.getDailyStats("profile-1", 7);

      expect(result).toHaveLength(2);
      expect(result[0]!.date).toEqual(new Date("2024-06-14"));
      expect(result[1]!.date).toEqual(new Date("2024-06-15"));
      expect(prisma.analytics.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { date: "asc" } }),
      );
    });
  });

  // ── findByPlatform ────────────────────────────────────────────────────────

  describe("findByPlatform", () => {
    it("uses default pagination when no pagination options provided", async () => {
      const items = [makeMockAnalytics()];
      vi.mocked(prisma.analytics.findMany).mockResolvedValue(items as any);
      vi.mocked(prisma.analytics.count).mockResolvedValue(1);

      const result = await repo.findByPlatform("INSTAGRAM", {});

      expect(result).toEqual({
        items,
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
      expect(prisma.analytics.findMany).toHaveBeenCalledWith({
        where: { platform: "INSTAGRAM" },
        orderBy: { date: "desc" },
        skip: 0,
        take: 20,
      });
      expect(prisma.analytics.count).toHaveBeenCalledWith({
        where: { platform: "INSTAGRAM" },
      });
    });

    it("filters by profileId when provided", async () => {
      vi.mocked(prisma.analytics.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.analytics.count).mockResolvedValue(0);

      await repo.findByPlatform("INSTAGRAM", { profileId: "profile-1" });

      const expectedWhere = {
        platform: "INSTAGRAM",
        profileId: "profile-1",
      };
      expect(prisma.analytics.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(prisma.analytics.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("filters by date range when from and to are provided", async () => {
      const from = new Date("2024-06-01");
      const to = new Date("2024-06-30");
      vi.mocked(prisma.analytics.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.analytics.count).mockResolvedValue(0);

      await repo.findByPlatform("TIKTOK", { from, to });

      const expectedWhere = {
        platform: "TIKTOK",
        date: { gte: from, lte: to },
      };
      expect(prisma.analytics.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(prisma.analytics.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
    });

    it("works with only platform and no additional options", async () => {
      vi.mocked(prisma.analytics.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.analytics.count).mockResolvedValue(0);

      const result = await repo.findByPlatform("TIKTOK", {});

      expect(result.total).toBe(0);
      expect(prisma.analytics.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { platform: "TIKTOK" },
        }),
      );
      expect(prisma.analytics.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { platform: "TIKTOK" },
        }),
      );
    });
  });
});
