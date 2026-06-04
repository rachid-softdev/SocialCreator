/**
 * Tests for PrismaNotificationRepository
 *
 * Verifies Prisma interaction patterns for notification CRUD,
 * pagination, unread filtering, and bulk mark-as-read.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock prisma ──────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { PrismaNotificationRepository } from "@/lib/repositories/notification.repository";

// ── Repository ───────────────────────────────────────────────────────────────

const repo = new PrismaNotificationRepository();

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: "notif-1",
    userId: "user-1",
    type: "INFO",
    title: "Test notification",
    message: "This is a test",
    data: {},
    read: false,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe("PrismaNotificationRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("should return notification when found", async () => {
      const mockNotif = makeNotification();
      (prisma.notification.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockNotif,
      );

      const result = await repo.findById("notif-1");

      expect(prisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: "notif-1" },
      });
      expect(result).toEqual(mockNotif);
    });

    it("should return null when not found", async () => {
      (prisma.notification.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const result = await repo.findById("nonexistent");

      expect(result).toBeNull();
    });

    it("should reject when prisma throws", async () => {
      (prisma.notification.findUnique as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.findById("notif-1")).rejects.toThrow("DB error");
    });
  });

  describe("findByUserId", () => {
    it("should return paginated notifications with defaults", async () => {
      const notifications = Array.from({ length: 3 }, (_, i) =>
        makeNotification({ id: `notif-${i + 1}` }),
      );
      (prisma.notification.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        notifications,
      );
      (prisma.notification.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(25);

      const result = await repo.findByUserId("user-1");

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
      expect(result.notifications).toHaveLength(3);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(2);
    });

    it("should apply unreadOnly filter", async () => {
      (prisma.notification.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.notification.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await repo.findByUserId("user-1", { unreadOnly: true });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1", read: false },
        }),
      );
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: "user-1", read: false },
      });
    });

    it("should paginate with custom page and pageSize", async () => {
      (prisma.notification.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.notification.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(50);

      const result = await repo.findByUserId("user-1", { page: 3, pageSize: 10 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(5);
    });

    it("should reject when prisma throws", async () => {
      (prisma.notification.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.findByUserId("user-1")).rejects.toThrow("DB error");
    });
  });

  describe("findUnreadByUserId", () => {
    it("should return unread notifications for user", async () => {
      const unread = [
        makeNotification({ id: "notif-1", read: false }),
        makeNotification({ id: "notif-2", read: false }),
      ];
      (prisma.notification.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        unread,
      );

      const result = await repo.findUnreadByUserId("user-1");

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", read: false },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no unread notifications", async () => {
      (prisma.notification.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await repo.findUnreadByUserId("user-1");

      expect(result).toStrictEqual([]);
    });

    it("should reject when prisma throws", async () => {
      (prisma.notification.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.findUnreadByUserId("user-1")).rejects.toThrow("DB error");
    });
  });

  describe("countUnread", () => {
    it("should return count of unread notifications", async () => {
      (prisma.notification.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const result = await repo.countUnread("user-1");

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: "user-1", read: false },
      });
      expect(result).toBe(5);
    });

    it("should return 0 when no unread notifications", async () => {
      (prisma.notification.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await repo.countUnread("user-1");

      expect(result).toBe(0);
    });

    it("should reject when prisma throws", async () => {
      (prisma.notification.count as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.countUnread("user-1")).rejects.toThrow("DB error");
    });
  });

  describe("create", () => {
    it("should create notification with all fields", async () => {
      const input = {
        userId: "user-1",
        type: "ALERT",
        title: "New notification",
        message: "Detailed message",
        data: { ref: "ref-123" },
      };

      const mockCreated = makeNotification({
        ...input,
        id: "notif-new",
      });
      (prisma.notification.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockCreated,
      );

      const result = await repo.create(input);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          type: "ALERT",
          title: "New notification",
          message: "Detailed message",
          data: { ref: "ref-123" },
        },
      });
      expect(result).toEqual(mockCreated);
    });

    it("should apply defaults for optional fields", async () => {
      const input = {
        userId: "user-1",
        type: "INFO",
        title: "Minimal notification",
      };

      (prisma.notification.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeNotification({ ...input, message: null, data: {} }),
      );

      await repo.create(input);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          type: "INFO",
          title: "Minimal notification",
          message: null,
          data: {},
        },
      });
    });

    it("should reject when prisma throws", async () => {
      (prisma.notification.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.create({ userId: "user-1", type: "INFO", title: "Fail" })).rejects.toThrow(
        "DB error",
      );
    });
  });

  describe("markAsRead", () => {
    it("should mark notification as read", async () => {
      const mockUpdated = makeNotification({ read: true });
      (prisma.notification.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUpdated,
      );

      const result = await repo.markAsRead("notif-1");

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: "notif-1" },
        data: { read: true },
      });
      expect(result.read).toBe(true);
    });

    it("should reject when prisma throws", async () => {
      (prisma.notification.update as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Not found"),
      );

      await expect(repo.markAsRead("nonexistent")).rejects.toThrow("Not found");
    });
  });

  describe("markAllAsRead", () => {
    it("should mark all unread notifications as read for user", async () => {
      (prisma.notification.updateMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 3,
      });

      const result = await repo.markAllAsRead("user-1");

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", read: false },
        data: { read: true },
      });
      expect(result).toBe(3);
    });

    it("should return 0 when no unread notifications", async () => {
      (prisma.notification.updateMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 0,
      });

      const result = await repo.markAllAsRead("user-1");

      expect(result).toBe(0);
    });

    it("should reject when prisma throws", async () => {
      (prisma.notification.updateMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(repo.markAllAsRead("user-1")).rejects.toThrow("DB error");
    });
  });
});
