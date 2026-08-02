/**
 * Tests for PrismaPublishLogRepository
 *
 * Verifies Prisma interaction patterns for publish log CRUD,
 * pagination, date-based queries, and daily stats aggregation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock prisma ──────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    publishLog: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
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

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { PrismaPublishLogRepository } from "@/lib/repositories/publish-log.repository";

// ── Repository ───────────────────────────────────────────────────────────────

const repo = new PrismaPublishLogRepository();

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "log-1",
    userId: "user-1",
    profileId: "profile-1",
    platform: "X",
    contentId: "content-1",
    contentHash: "abc123",
    success: true,
    error: null,
    publishedAt: new Date("2024-06-15T10:00:00.000Z"),
    createdAt: new Date("2024-06-15T10:00:00.000Z"),
    updatedAt: new Date("2024-06-15T10:00:00.000Z"),
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe("PrismaPublishLogRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("should return log when found", async () => {
      const mockLog = makeLog();
      (prisma.publishLog.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLog,
      );

      const result = await repo.findById("log-1");

      expect(prisma.publishLog.findUnique).toHaveBeenCalledWith({
        where: { id: "log-1" },
      });
      expect(result).toEqual(mockLog);
    });

    it("should return null when not found", async () => {
      (prisma.publishLog.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await repo.findById("nonexistent");

      expect(result).toBeNull();
    });

    it("should reject when prisma throws", async () => {
      (prisma.publishLog.findUnique as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.findById("log-1")).rejects.toThrow("DB error");
    });
  });

  describe("findByUserId", () => {
    it("should return paginated logs with defaults", async () => {
      const logs = [makeLog({ id: "log-1" }), makeLog({ id: "log-2" })];
      (prisma.publishLog.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(logs);
      (prisma.publishLog.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(15);

      const result = await repo.findByUserId("user-1");

      expect(prisma.publishLog.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { publishedAt: "desc" },
        skip: 0,
        take: 20,
      });
      expect(prisma.publishLog.count).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(15);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it("should paginate with custom options", async () => {
      (prisma.publishLog.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.publishLog.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(100);

      const result = await repo.findByUserId("user-1", { page: 3, pageSize: 10 });

      expect(prisma.publishLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(10);
    });

    it("should reject when prisma throws", async () => {
      (prisma.publishLog.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.findByUserId("user-1")).rejects.toThrow("DB error");
    });
  });

  describe("findByProfileId", () => {
    it("should return paginated logs for a profile", async () => {
      const logs = [makeLog({ id: "log-1" }), makeLog({ id: "log-2" })];
      (prisma.publishLog.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(logs);

      const result = await repo.findByProfileId("profile-1");

      expect(prisma.publishLog.findMany).toHaveBeenCalledWith({
        where: { profileId: "profile-1" },
        orderBy: { publishedAt: "desc" },
        skip: 0,
        take: 20,
      });
      expect(result).toHaveLength(2);
    });

    it("should paginate with custom page and pageSize", async () => {
      (prisma.publishLog.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await repo.findByProfileId("profile-1", { page: 2, pageSize: 5 });

      expect(prisma.publishLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });

    it("should reject when prisma throws", async () => {
      (prisma.publishLog.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.findByProfileId("profile-1")).rejects.toThrow("DB error");
    });
  });

  describe("create", () => {
    const createInput = {
      userId: "user-1",
      profileId: "profile-1",
      platform: "X" as const,
      contentId: "content-1",
      contentHash: "hash123",
      success: true,
    };

    it("should create publish log with all fields", async () => {
      const mockCreated = makeLog({ id: "log-new" });
      (prisma.publishLog.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockCreated,
      );

      const result = await repo.create(createInput);

      expect(prisma.publishLog.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          profileId: "profile-1",
          platform: "X",
          contentId: "content-1",
          contentHash: "hash123",
          success: true,
          error: null,
        },
      });
      expect(result).toEqual(mockCreated);
    });

    it("should include error when provided", async () => {
      (prisma.publishLog.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeLog({ error: "API error" }),
      );

      await repo.create({ ...createInput, success: false, error: "API error" });

      expect(prisma.publishLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: false,
          error: "API error",
        }),
      });
    });

    it("should reject when prisma throws", async () => {
      (prisma.publishLog.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.create(createInput)).rejects.toThrow("DB error");
    });
  });

  describe("countPublishedToday", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should count successful publishes from start of today", async () => {
      vi.setSystemTime(new Date("2024-06-15T14:30:00.000Z"));
      (prisma.publishLog.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      const result = await repo.countPublishedToday("profile-1", "X" as any);

      // The exact gte value depends on local timezone (setHours uses local TZ)
      // so we assert the structure rather than the exact date
      expect(prisma.publishLog.count).toHaveBeenCalledWith({
        where: {
          profileId: "profile-1",
          platform: "X",
          success: true,
          publishedAt: expect.objectContaining({ gte: expect.any(Date) }),
        },
      });
      expect(result).toBe(3);
    });

    it("should return 0 when nothing published today", async () => {
      vi.setSystemTime(new Date("2024-06-15T14:30:00.000Z"));
      (prisma.publishLog.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await repo.countPublishedToday("profile-1", "INSTAGRAM" as any);

      expect(result).toBe(0);
    });

    it("should reject when prisma throws", async () => {
      vi.setSystemTime(new Date("2024-06-15T14:30:00.000Z"));
      (prisma.publishLog.count as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.countPublishedToday("profile-1", "X" as any)).rejects.toThrow("DB error");
    });
  });

  describe("findByContentHash", () => {
    it("should find log by content hash ordered by publishedAt desc", async () => {
      const mockLog = makeLog();
      (prisma.publishLog.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLog,
      );

      const result = await repo.findByContentHash("abc123");

      expect(prisma.publishLog.findFirst).toHaveBeenCalledWith({
        where: { contentHash: "abc123" },
        orderBy: { publishedAt: "desc" },
      });
      expect(result).toEqual(mockLog);
    });

    it("should return null when hash not found", async () => {
      (prisma.publishLog.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await repo.findByContentHash("nonexistent");

      expect(result).toBeNull();
    });

    it("should reject when prisma throws", async () => {
      (prisma.publishLog.findFirst as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.findByContentHash("abc123")).rejects.toThrow("DB error");
    });
  });

  describe("getDailyStats", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return daily stats grouped by date", async () => {
      // Freeze time to a known date
      vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));

      const logs = [
        makeLog({ success: true, publishedAt: new Date("2024-06-15T08:00:00.000Z") }),
        makeLog({ success: true, publishedAt: new Date("2024-06-15T09:00:00.000Z") }),
        makeLog({ success: false, publishedAt: new Date("2024-06-14T10:00:00.000Z") }),
        makeLog({ success: true, publishedAt: new Date("2024-06-13T11:00:00.000Z") }),
      ];

      (prisma.publishLog.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(logs);

      const result = await repo.getDailyStats("user-1", 3);

      // Verify query: logs since Date.now() - 3 days
      const threeDaysAgo = new Date("2024-06-12T12:00:00.000Z");
      expect(prisma.publishLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          publishedAt: { gte: threeDaysAgo },
        },
        orderBy: { publishedAt: "asc" },
      });

      // Expect 3 days of stats sorted by date
      expect(result).toHaveLength(3);
      expect(result[0]!.date).toBe("2024-06-13");
      expect(result[0]!.success).toBe(1);
      expect(result[0]!.failed).toBe(0);
      expect(result[1]!.date).toBe("2024-06-14");
      expect(result[1]!.success).toBe(0);
      expect(result[1]!.failed).toBe(1);
      expect(result[2]!.date).toBe("2024-06-15");
      expect(result[2]!.success).toBe(2);
      expect(result[2]!.failed).toBe(0);
    });

    it("should return empty stats when no logs found", async () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
      (prisma.publishLog.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await repo.getDailyStats("user-1", 3);

      expect(result).toHaveLength(3);
      // All days should have zero counts
      for (const day of result) {
        expect(day.success).toBe(0);
        expect(day.failed).toBe(0);
      }
    });

    it("should handle single day range", async () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));

      const logs = [
        makeLog({ success: true, publishedAt: new Date("2024-06-15T08:00:00.000Z") }),
        makeLog({ success: false, publishedAt: new Date("2024-06-15T09:00:00.000Z") }),
      ];

      (prisma.publishLog.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(logs);

      const result = await repo.getDailyStats("user-1", 1);

      expect(result).toHaveLength(1);
      expect(result[0]!.date).toBe("2024-06-15");
      expect(result[0]!.success).toBe(1);
      expect(result[0]!.failed).toBe(1);
    });

    it("should handle multiple days with mixed results", async () => {
      vi.setSystemTime(new Date("2024-06-10T12:00:00.000Z"));

      const logs = [
        makeLog({ success: true, publishedAt: new Date("2024-06-08T10:00:00.000Z") }),
        makeLog({ success: true, publishedAt: new Date("2024-06-08T11:00:00.000Z") }),
        makeLog({ success: false, publishedAt: new Date("2024-06-08T12:00:00.000Z") }),
        makeLog({ success: true, publishedAt: new Date("2024-06-09T10:00:00.000Z") }),
      ];

      (prisma.publishLog.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(logs);

      const result = await repo.getDailyStats("user-1", 5);

      // Should have 5 days: June 6, 7, 8, 9, 10
      expect(result).toHaveLength(5);
      expect(result[0]!.date).toBe("2024-06-06");
      expect(result[1]!.date).toBe("2024-06-07");
      expect(result[2]!.date).toBe("2024-06-08");
      expect(result[3]!.date).toBe("2024-06-09");
      expect(result[4]!.date).toBe("2024-06-10");

      // June 8: 2 success, 1 failed
      expect(result[2]!.success).toBe(2);
      expect(result[2]!.failed).toBe(1);

      // June 9: 1 success, 0 failed
      expect(result[3]!.success).toBe(1);
      expect(result[3]!.failed).toBe(0);
    });

    it("should reject when prisma throws", async () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
      (prisma.publishLog.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.getDailyStats("user-1", 7)).rejects.toThrow("DB error");
    });
  });
});
