/**
 * Tests for notification service
 *
 * Tests createNotification and broadcastNotification
 * Mocks repositories and Redis
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNotificationRepo = {
  create: vi.fn(),
};

const mockRedis = {
  publish: vi.fn(),
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => ({
    notification: mockNotificationRepo,
  })),
}));

vi.mock("@/lib/infrastructure/rate-limit-redis", () => ({
  getRedis: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { getRedis } from "@/lib/infrastructure/rate-limit-redis";
import logger from "@/lib/logger";
import { broadcastNotification, createNotification } from "@/lib/services/notification-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockInput = {
  userId: "user-1",
  type: "test_notification",
  title: "Test Notification",
  message: "This is a test",
  data: { key: "value" },
};

const mockCreatedNotification = {
  id: "notif-1",
  userId: "user-1",
  type: "test_notification",
  title: "Test Notification",
  message: "This is a test",
  data: { key: "value" },
  read: false,
  createdAt: new Date("2026-06-03T12:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create notification in DB and publish to Redis", async () => {
    mockNotificationRepo.create.mockResolvedValue(mockCreatedNotification);
    vi.mocked(getRedis).mockReturnValue(mockRedis as any);

    const result = await createNotification(mockInput);

    expect(mockNotificationRepo.create).toHaveBeenCalledWith({
      userId: "user-1",
      type: "test_notification",
      title: "Test Notification",
      message: "This is a test",
      data: { key: "value" },
    });
    expect(result).toEqual(mockCreatedNotification);
    expect(mockRedis.publish).toHaveBeenCalledWith(
      "user:user-1:notifications",
      expect.stringContaining("new_notification"),
    );
  });

  it("should skip Redis when getRedis returns null", async () => {
    mockNotificationRepo.create.mockResolvedValue(mockCreatedNotification);
    vi.mocked(getRedis).mockReturnValue(null);

    const result = await createNotification(mockInput);

    expect(result).toEqual(mockCreatedNotification);
    expect(mockRedis.publish).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  it("should handle Redis publish failure gracefully and still return notification", async () => {
    mockNotificationRepo.create.mockResolvedValue(mockCreatedNotification);
    vi.mocked(getRedis).mockReturnValue(mockRedis as any);
    mockRedis.publish.mockRejectedValue(new Error("Redis connection lost"));

    const result = await createNotification(mockInput);

    expect(result).toEqual(mockCreatedNotification);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        userId: "user-1",
        notificationId: "notif-1",
      }),
      "Failed to publish notification to Redis",
    );
  });

  it("should create notification without optional message and data", async () => {
    const minimalInput = {
      userId: "user-2",
      type: "simple",
      title: "Simple Notification",
    };
    mockNotificationRepo.create.mockResolvedValue({
      ...mockCreatedNotification,
      id: "notif-2",
      userId: "user-2",
      type: "simple",
      title: "Simple Notification",
      message: undefined,
      data: undefined,
    });
    vi.mocked(getRedis).mockReturnValue(null);

    const result = await createNotification(minimalInput);

    expect(result.id).toBe("notif-2");
    expect(mockNotificationRepo.create).toHaveBeenCalledWith(minimalInput);
  });
});

describe("broadcastNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create notifications for all recipients", async () => {
    const userIds = ["user-1", "user-2", "user-3"];
    const input = {
      type: "broadcast",
      title: "Broadcast Notification",
      message: "Everyone gets this",
    };

    mockNotificationRepo.create
      .mockResolvedValueOnce({ ...mockCreatedNotification, id: "n-1", userId: "user-1" })
      .mockResolvedValueOnce({ ...mockCreatedNotification, id: "n-2", userId: "user-2" })
      .mockResolvedValueOnce({ ...mockCreatedNotification, id: "n-3", userId: "user-3" });

    vi.mocked(getRedis).mockReturnValue(mockRedis as any);
    mockRedis.publish.mockResolvedValue(undefined);

    const result = await broadcastNotification(userIds, input);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("n-1");
    expect(result[1].id).toBe("n-2");
    expect(result[2].id).toBe("n-3");
    expect(mockNotificationRepo.create).toHaveBeenCalledTimes(3);
  });

  it("should handle empty recipient list", async () => {
    const result = await broadcastNotification([], {
      type: "broadcast",
      title: "Test",
    });

    expect(result).toHaveLength(0);
    expect(mockNotificationRepo.create).not.toHaveBeenCalled();
  });
});
