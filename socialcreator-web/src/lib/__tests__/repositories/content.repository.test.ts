/**
 * Tests for PrismaContentRepository
 *
 * Verifies Prisma interaction patterns for generated content CRUD,
 * filtering, pagination, status management, scheduled content queries,
 * special queries, and batch operations.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock prisma ──────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    generatedContent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import type {
  ContentFilterOptions,
  UpdateContentInput,
} from "@/lib/repositories/content.repository";
import { PrismaContentRepository } from "@/lib/repositories/content.repository";

// ── Repository ───────────────────────────────────────────────────────────────

const repo = new PrismaContentRepository();

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeContent(overrides: Record<string, unknown> = {}) {
  return {
    id: "content-1",
    profileId: "profile-1",
    runId: "run-1",
    platform: "X",
    textContent: "Hello world",
    mediaUrls: [] as string[],
    hashtags: ["test"] as string[],
    status: "DRAFT",
    scheduledPublishAt: null,
    scheduledTimezone: null,
    publishedAt: null,
    postId: null,
    postUrl: null,
    rejectedAt: null,
    rejectionReason: null,
    errorMessage: null,
    metadata: {},
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    profile: { id: "profile-1", name: "Test Profile" },
    run: {
      id: "run-1",
      agent: { id: "agent-1", name: "Test Agent" },
    },
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe("PrismaContentRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // CRUD
  // ────────────────────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("should return content with profile, run and agent when found", async () => {
      const mockContent = makeContent();
      (prisma.generatedContent.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockContent,
      );

      const result = await repo.findById("content-1");

      expect(prisma.generatedContent.findUnique).toHaveBeenCalledWith({
        where: { id: "content-1" },
        include: {
          profile: { select: { id: true, name: true } },
          run: {
            select: {
              id: true,
              agent: { select: { id: true, name: true } },
            },
          },
        },
      });
      expect(result).toEqual(mockContent);
      expect((result as any)?.run?.agent?.name).toBe("Test Agent");
    });

    it("should return null when content not found", async () => {
      (prisma.generatedContent.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const result = await repo.findById("nonexistent");

      expect(result).toBeNull();
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.findUnique as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.findById("content-1")).rejects.toThrow("DB error");
    });
  });

  describe("create", () => {
    it("should create and return content", async () => {
      const createInput = {
        profileId: "profile-1",
        platform: "X",
        textContent: "New post",
        mediaUrls: [],
        hashtags: [],
        status: "DRAFT",
      };

      const mockCreated = makeContent({ id: "content-new", textContent: "New post" });
      (prisma.generatedContent.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockCreated,
      );

      const result = await repo.create(createInput as any);

      expect(prisma.generatedContent.create).toHaveBeenCalledWith({
        data: createInput,
      });
      expect(result).toEqual(mockCreated);
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(
        repo.create({
          profileId: "p-1",
          platform: "X",
          textContent: "x",
          mediaUrls: [],
          hashtags: [],
          status: "DRAFT",
        } as any),
      ).rejects.toThrow("DB error");
    });
  });

  describe("update", () => {
    it("should update and return content", async () => {
      const updateData: UpdateContentInput = { textContent: "Updated text" };
      const mockUpdated = makeContent({ textContent: "Updated text" });
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUpdated,
      );

      const result = await repo.update("content-1", updateData);

      expect(prisma.generatedContent.update).toHaveBeenCalledWith({
        where: { id: "content-1" },
        data: updateData,
      });
      expect(result.textContent).toBe("Updated text");
    });

    it("should handle partial updates", async () => {
      const updateData: UpdateContentInput = { hashtags: ["new", "tags"] };
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeContent({ hashtags: ["new", "tags"] }),
      );

      await repo.update("content-1", updateData);

      expect(prisma.generatedContent.update).toHaveBeenCalledWith({
        where: { id: "content-1" },
        data: { hashtags: ["new", "tags"] },
      });
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Not found"),
      );

      await expect(repo.update("nonexistent", { textContent: "x" })).rejects.toThrow("Not found");
    });
  });

  describe("delete", () => {
    it("should delete content by id", async () => {
      (prisma.generatedContent.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        {} as any,
      );

      await repo.delete("content-1");

      expect(prisma.generatedContent.delete).toHaveBeenCalledWith({
        where: { id: "content-1" },
      });
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.delete as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Not found"),
      );

      await expect(repo.delete("nonexistent")).rejects.toThrow("Not found");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Filtering & Pagination
  // ────────────────────────────────────────────────────────────────────────────

  describe("findByProfileId", () => {
    it("should return paginated contents without filters", async () => {
      const contents = [makeContent({ id: "c-1" }), makeContent({ id: "c-2" })];
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        contents,
      );
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(25);

      const result = await repo.findByProfileId("profile-1");

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith({
        where: { profileId: "profile-1" },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
        include: { profile: { select: { id: true, name: true } } },
      });
      expect(prisma.generatedContent.count).toHaveBeenCalledWith({
        where: { profileId: "profile-1" },
      });
      expect(result.contents).toHaveLength(2);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(2);
    });

    it("should apply status filter", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const options: ContentFilterOptions = { status: "PUBLISHED" as any };
      await repo.findByProfileId("profile-1", options);

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ profileId: "profile-1", status: "PUBLISHED" }),
        }),
      );
    });

    it("should apply platform filter", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const options: ContentFilterOptions = { platform: "INSTAGRAM" as any };
      await repo.findByProfileId("profile-1", options);

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ profileId: "profile-1", platform: "INSTAGRAM" }),
        }),
      );
    });

    it("should combine status and platform filters with pagination math", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(50);

      const options: ContentFilterOptions = {
        status: "SCHEDULED" as any,
        platform: "X" as any,
        page: 3,
        pageSize: 10,
      };
      const result = await repo.findByProfileId("profile-1", options);

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { profileId: "profile-1", status: "SCHEDULED", platform: "X" },
          skip: 20,
          take: 10,
        }),
      );
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(5);
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.findByProfileId("profile-1")).rejects.toThrow("DB error");
    });
  });

  describe("findByUserId", () => {
    it("should return paginated contents with profile.userId filter", async () => {
      const contents = [makeContent({ id: "c-1" })];
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        contents,
      );
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(10);

      const result = await repo.findByUserId("user-1");

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith({
        where: { profile: { userId: "user-1" } },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
        include: {
          profile: { select: { id: true, name: true } },
          run: {
            select: {
              id: true,
              agent: { select: { id: true, name: true } },
            },
          },
        },
      });
      expect(result.contents).toHaveLength(1);
      expect(result.total).toBe(10);
    });

    it("should apply status and platform filters", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const options: ContentFilterOptions = {
        status: "FAILED" as any,
        platform: "X" as any,
      };
      await repo.findByUserId("user-1", options);

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { profile: { userId: "user-1" }, status: "FAILED", platform: "X" },
        }),
      );
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.findByUserId("user-1")).rejects.toThrow("DB error");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Status Management
  // ────────────────────────────────────────────────────────────────────────────

  describe("updateStatus", () => {
    it("should update content status", async () => {
      const mockUpdated = makeContent({ status: "PUBLISHED" });
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUpdated,
      );

      const result = await repo.updateStatus("content-1", "PUBLISHED" as any);

      expect(prisma.generatedContent.update).toHaveBeenCalledWith({
        where: { id: "content-1" },
        data: { status: "PUBLISHED" },
      });
      expect(result.status).toBe("PUBLISHED");
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Not found"),
      );

      await expect(repo.updateStatus("nonexistent", "APPROVED" as any)).rejects.toThrow(
        "Not found",
      );
    });
  });

  describe("schedule", () => {
    it("should set status to SCHEDULED with scheduledPublishAt", async () => {
      const publishAt = new Date("2024-07-01T10:00:00.000Z");
      const mockUpdated = makeContent({ status: "SCHEDULED", scheduledPublishAt: publishAt });
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUpdated,
      );

      const result = await repo.schedule("content-1", publishAt);

      expect(prisma.generatedContent.update).toHaveBeenCalledWith({
        where: { id: "content-1" },
        data: { status: "SCHEDULED", scheduledPublishAt: publishAt },
      });
      expect(result.status).toBe("SCHEDULED");
      expect(result.scheduledPublishAt).toEqual(publishAt);
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Not found"),
      );

      await expect(repo.schedule("nonexistent", new Date())).rejects.toThrow("Not found");
    });
  });

  describe("resetToApproved", () => {
    it("should set status to APPROVED", async () => {
      const mockUpdated = makeContent({ status: "APPROVED" });
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUpdated,
      );

      const result = await repo.resetToApproved("content-1");

      expect(prisma.generatedContent.update).toHaveBeenCalledWith({
        where: { id: "content-1" },
        data: { status: "APPROVED" },
      });
      expect(result.status).toBe("APPROVED");
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Not found"),
      );

      await expect(repo.resetToApproved("nonexistent")).rejects.toThrow("Not found");
    });
  });

  describe("cancelSchedule", () => {
    it("should set status to APPROVED and clear scheduledPublishAt", async () => {
      const mockUpdated = makeContent({ status: "APPROVED", scheduledPublishAt: null });
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUpdated,
      );

      const result = await repo.cancelSchedule("content-1");

      expect(prisma.generatedContent.update).toHaveBeenCalledWith({
        where: { id: "content-1" },
        data: { status: "APPROVED", scheduledPublishAt: null },
      });
      expect(result.status).toBe("APPROVED");
      expect(result.scheduledPublishAt).toBeNull();
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Not found"),
      );

      await expect(repo.cancelSchedule("nonexistent")).rejects.toThrow("Not found");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Scheduled Content
  // ────────────────────────────────────────────────────────────────────────────

  describe("findPendingScheduled", () => {
    it("should find scheduled content before given date", async () => {
      const before = new Date("2024-06-15T12:00:00.000Z");
      const scheduled = [
        makeContent({ id: "s-1", status: "SCHEDULED" }),
        makeContent({ id: "s-2", status: "SCHEDULED" }),
      ];
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        scheduled,
      );

      const result = await repo.findPendingScheduled(before);

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith({
        where: {
          status: "SCHEDULED",
          scheduledPublishAt: { lte: before },
        },
      });
      expect(result).toHaveLength(2);
    });

    it("should return empty array when none pending", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const result = await repo.findPendingScheduled(new Date("2024-01-01"));

      expect(result).toStrictEqual([]);
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.findPendingScheduled(new Date())).rejects.toThrow("DB error");
    });
  });

  describe("findScheduledByProfileAndTime", () => {
    it("should find scheduled content within time window for profile", async () => {
      const start = new Date("2024-06-01T00:00:00.000Z");
      const end = new Date("2024-06-30T23:59:59.000Z");
      const scheduled = [
        makeContent({ id: "s-1", status: "SCHEDULED", scheduledPublishAt: new Date("2024-06-15") }),
      ];
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        scheduled,
      );

      const result = await repo.findScheduledByProfileAndTime("profile-1", start, end);

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith({
        where: {
          profileId: "profile-1",
          status: "SCHEDULED",
          scheduledPublishAt: { gte: start, lte: end },
        },
        orderBy: { scheduledPublishAt: "asc" },
      });
      expect(result).toHaveLength(1);
    });

    it("should return empty array when no content in window", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const result = await repo.findScheduledByProfileAndTime(
        "profile-1",
        new Date("2024-01-01"),
        new Date("2024-01-31"),
      );

      expect(result).toStrictEqual([]);
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(
        repo.findScheduledByProfileAndTime("profile-1", new Date(), new Date()),
      ).rejects.toThrow("DB error");
    });
  });

  describe("findScheduledByDateRange", () => {
    it("should find scheduled content by date range for user", async () => {
      const from = new Date("2024-06-01T00:00:00.000Z");
      const to = new Date("2024-06-30T23:59:59.000Z");
      const scheduled = [makeContent({ id: "s-1", status: "SCHEDULED" })];
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        scheduled,
      );

      const result = await repo.findScheduledByDateRange("user-1", from, to);

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith({
        where: {
          status: "SCHEDULED",
          scheduledPublishAt: { gte: from, lte: to },
          profile: { userId: "user-1" },
        },
        orderBy: { scheduledPublishAt: "asc" },
        include: { profile: { select: { id: true, name: true } } },
      });
      expect(result).toHaveLength(1);
    });

    it("should include optional platform filter", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      await repo.findScheduledByDateRange(
        "user-1",
        new Date("2024-06-01"),
        new Date("2024-06-30"),
        "X",
      );

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            platform: "X",
          }),
        }),
      );
    });

    it("should return empty array when no content found", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const result = await repo.findScheduledByDateRange(
        "user-1",
        new Date("2024-01-01"),
        new Date("2024-01-31"),
      );

      expect(result).toStrictEqual([]);
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.findScheduledByDateRange("user-1", new Date(), new Date())).rejects.toThrow(
        "DB error",
      );
    });
  });

  describe("countScheduledAtTime", () => {
    it("should count scheduled content at exact time", async () => {
      const time = new Date("2024-06-15T10:00:00.000Z");
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await repo.countScheduledAtTime("profile-1", time);

      expect(prisma.generatedContent.count).toHaveBeenCalledWith({
        where: {
          profileId: "profile-1",
          status: "SCHEDULED",
          scheduledPublishAt: { equals: time },
        },
      });
      expect(result).toBe(2);
    });

    it("should return 0 when no content scheduled at that time", async () => {
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await repo.countScheduledAtTime("profile-1", new Date());

      expect(result).toBe(0);
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.countScheduledAtTime("profile-1", new Date())).rejects.toThrow("DB error");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Special Queries
  // ────────────────────────────────────────────────────────────────────────────

  describe("countPublishedToday", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should count published content from start of today", async () => {
      vi.setSystemTime(new Date("2024-06-15T14:30:00.000Z"));
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const result = await repo.countPublishedToday("profile-1", "X" as any);

      // The exact gte value depends on local timezone (setHours uses local TZ)
      // so we assert the structure rather than the exact date
      expect(prisma.generatedContent.count).toHaveBeenCalledWith({
        where: {
          profileId: "profile-1",
          platform: "X",
          status: "PUBLISHED",
          publishedAt: expect.objectContaining({ gte: expect.any(Date) }),
        },
      });
      expect(result).toBe(5);
    });

    it("should return 0 when nothing published today", async () => {
      vi.setSystemTime(new Date("2024-06-15T14:30:00.000Z"));
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await repo.countPublishedToday("profile-1", "INSTAGRAM" as any);

      expect(result).toBe(0);
    });

    it("should reject when prisma throws", async () => {
      vi.setSystemTime(new Date("2024-06-15T14:30:00.000Z"));
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.countPublishedToday("profile-1", "X" as any)).rejects.toThrow("DB error");
    });
  });

  describe("findByRunId", () => {
    it("should return content for a run ordered by createdAt desc", async () => {
      const contents = [
        makeContent({ id: "c-2", runId: "run-1", createdAt: new Date("2024-02-01") }),
        makeContent({ id: "c-1", runId: "run-1", createdAt: new Date("2024-01-01") }),
      ];
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        contents,
      );

      const result = await repo.findByRunId("run-1");

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith({
        where: { runId: "run-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(2);
    });

    it("should return empty array when run has no content", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      const result = await repo.findByRunId("nonexistent");

      expect(result).toStrictEqual([]);
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.findByRunId("run-1")).rejects.toThrow("DB error");
    });
  });

  describe("findFailed", () => {
    it("should return paginated failed content", async () => {
      const failed = [makeContent({ id: "f-1", status: "FAILED" })];
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        failed,
      );
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const result = await repo.findFailed();

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith({
        where: { status: "FAILED" },
        orderBy: { updatedAt: "desc" },
        skip: 0,
        take: 20,
        include: { profile: { select: { id: true, name: true } } },
      });
      expect(result.contents).toHaveLength(1);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it("should apply profileId filter when provided", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await repo.findFailed({ profileId: "profile-1", page: 2, pageSize: 5 });

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "FAILED", profileId: "profile-1" },
          skip: 5,
          take: 5,
        }),
      );
    });

    it("should reject when prisma throws", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.findFailed()).rejects.toThrow("DB error");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Batch Operations
  // ────────────────────────────────────────────────────────────────────────────

  describe("batchReschedule", () => {
    it("should return 0 for empty array", async () => {
      const result = await repo.batchReschedule([]);

      expect(result).toBe(0);
      expect(prisma.generatedContent.update).not.toHaveBeenCalled();
    });

    it("should update all items and return count", async () => {
      const items = [
        { id: "c-1", scheduledPublishAt: new Date("2024-07-01T10:00:00.000Z") },
        { id: "c-2", scheduledPublishAt: new Date("2024-07-02T10:00:00.000Z") },
        { id: "c-3", scheduledPublishAt: new Date("2024-07-03T10:00:00.000Z") },
      ];

      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        {} as any,
      );

      const result = await repo.batchReschedule(items);

      expect(prisma.generatedContent.update).toHaveBeenCalledTimes(3);
      expect(prisma.generatedContent.update).toHaveBeenCalledWith({
        where: { id: "c-1" },
        data: { scheduledPublishAt: items[0].scheduledPublishAt },
      });
      expect(prisma.generatedContent.update).toHaveBeenCalledWith({
        where: { id: "c-2" },
        data: { scheduledPublishAt: items[1].scheduledPublishAt },
      });
      expect(prisma.generatedContent.update).toHaveBeenCalledWith({
        where: { id: "c-3" },
        data: { scheduledPublishAt: items[2].scheduledPublishAt },
      });
      expect(result).toBe(3);
    });

    it("should reject when prisma throws on any update", async () => {
      const items = [
        { id: "c-1", scheduledPublishAt: new Date() },
        { id: "c-2", scheduledPublishAt: new Date() },
      ];

      (prisma.generatedContent.update as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({} as any)
        .mockRejectedValueOnce(new Error("Not found"));

      await expect(repo.batchReschedule(items)).rejects.toThrow("Not found");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Pagination edge cases (shared)
  // ────────────────────────────────────────────────────────────────────────────

  describe("pagination math (shared)", () => {
    it("should calculate skip correctly for page 1", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await repo.findByProfileId("profile-1", { page: 1, pageSize: 10 });

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it("should calculate skip correctly for page 3", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await repo.findFailed({ page: 3, pageSize: 15 });

      expect(prisma.generatedContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 30, take: 15 }),
      );
    });

    it("should calculate totalPages correctly", async () => {
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(101);

      const result = await repo.findByProfileId("profile-1", { page: 1, pageSize: 10 });

      expect(result.totalPages).toBe(11);
    });
  });
});
