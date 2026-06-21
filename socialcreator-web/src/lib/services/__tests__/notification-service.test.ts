/**
 * Tests for notification service (notification-service.ts)
 *
 * Covers createNotification and broadcastNotification.
 * Mocks repositories and Redis for controlled testing.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockNotificationRepo, mockRedis } = vi.hoisted(() => ({
  mockNotificationRepo: { create: vi.fn() },
  mockRedis: { publish: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

function assertNewNotificationEvent(channel: string, payload: string): void {
  const parsed = JSON.parse(payload);
  expect(parsed.type).toBe("new_notification");
  expect(parsed.notification).toBeDefined();
  expect(parsed.notification.id).toBeDefined();
  expect(parsed.notification.title).toBeDefined();
}

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

    // Verify DB creation
    expect(mockNotificationRepo.create).toHaveBeenCalledWith({
      userId: "user-1",
      type: "test_notification",
      title: "Test Notification",
      message: "This is a test",
      data: { key: "value" },
    });
    expect(result).toEqual(mockCreatedNotification);

    // Verify Redis publish
    expect(mockRedis.publish).toHaveBeenCalledWith("user:user-1:notifications", expect.any(String));
    assertNewNotificationEvent("user:user-1:notifications", mockRedis.publish.mock.calls[0][1]);
  });

  it("should skip Redis publish when getRedis returns null (not configured)", async () => {
    mockNotificationRepo.create.mockResolvedValue(mockCreatedNotification);
    vi.mocked(getRedis).mockReturnValue(null);

    const result = await createNotification(mockInput);

    expect(result).toEqual(mockCreatedNotification);
    expect(mockRedis.publish).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        notificationId: "notif-1",
      }),
      "Redis not configured, skipping real-time notification delivery",
    );
  });

  it("should handle Redis publish failure gracefully (log error, continue)", async () => {
    mockNotificationRepo.create.mockResolvedValue(mockCreatedNotification);
    vi.mocked(getRedis).mockReturnValue(mockRedis as any);
    mockRedis.publish.mockRejectedValue(new Error("Redis connection lost"));

    const result = await createNotification(mockInput);

    // Notification is still returned
    expect(result).toEqual(mockCreatedNotification);

    // Error is logged
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        userId: "user-1",
        notificationId: "notif-1",
      }),
      "Failed to publish notification to Redis",
    );
  });

  it("should propagate error when notificationRepo.create throws", async () => {
    mockNotificationRepo.create.mockRejectedValue(new Error("DB write failed"));
    vi.mocked(getRedis).mockReturnValue(mockRedis as any);

    await expect(createNotification(mockInput)).rejects.toThrow("DB write failed");

    // Redis should NOT be called if DB creation fails
    expect(mockRedis.publish).not.toHaveBeenCalled();
  });

  it("should work without optional message and data fields", async () => {
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
      message: null,
      data: {},
    });
    vi.mocked(getRedis).mockReturnValue(null);

    const result = await createNotification(minimalInput);

    expect(result.id).toBe("notif-2");
    expect(mockNotificationRepo.create).toHaveBeenCalledWith(minimalInput);
  });

  it("should publish the correct JSON payload format to Redis", async () => {
    mockNotificationRepo.create.mockResolvedValue(mockCreatedNotification);
    vi.mocked(getRedis).mockReturnValue(mockRedis as any);

    await createNotification(mockInput);

    const channel = mockRedis.publish.mock.calls[0][0];
    const payload = JSON.parse(mockRedis.publish.mock.calls[0][1]);

    expect(channel).toBe("user:user-1:notifications");
    expect(payload).toEqual({
      type: "new_notification",
      notification: {
        id: "notif-1",
        type: "test_notification",
        title: "Test Notification",
        message: "This is a test",
        data: { key: "value" },
        read: false,
        createdAt: mockCreatedNotification.createdAt.toISOString(),
      },
    });
  });
});

// ============================================
// broadcastNotification
// ============================================

describe("broadcastNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create notifications for all recipient userIds", async () => {
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
    expect(result[0].userId).toBe("user-1");
    expect(result[1].userId).toBe("user-2");
    expect(result[2].userId).toBe("user-3");
    expect(mockNotificationRepo.create).toHaveBeenCalledTimes(3);
  });

  it("should handle empty recipient list (return empty array)", async () => {
    const result = await broadcastNotification([], {
      type: "broadcast",
      title: "Test",
    });

    expect(result).toHaveLength(0);
    expect(mockNotificationRepo.create).not.toHaveBeenCalled();
  });

  it("should fail entirely when one notification creation throws (Promise.all semantics)", async () => {
    const userIds = ["user-1", "user-2", "user-3"];
    const input = {
      type: "broadcast",
      title: "Partial Failure Test",
    };

    mockNotificationRepo.create
      .mockResolvedValueOnce({ ...mockCreatedNotification, id: "n-1", userId: "user-1" })
      .mockRejectedValueOnce(new Error("DB constraint violation"))
      .mockResolvedValueOnce({ ...mockCreatedNotification, id: "n-3", userId: "user-3" });

    vi.mocked(getRedis).mockReturnValue(mockRedis as any);

    // Promise.all rejects immediately on first failure — error propagates
    await expect(broadcastNotification(userIds, input)).rejects.toThrow("DB constraint violation");
  });

  it("should include additional fields (data) for each broadcast notification", async () => {
    const userIds = ["user-1", "user-2"];
    const input = {
      type: "team_event",
      title: "Team Update",
      message: "New member joined",
      data: { teamId: "team-42", event: "member_joined" },
    };

    mockNotificationRepo.create
      .mockResolvedValueOnce({ ...mockCreatedNotification, id: "n-1", userId: "user-1" })
      .mockResolvedValueOnce({ ...mockCreatedNotification, id: "n-2", userId: "user-2" });

    vi.mocked(getRedis).mockReturnValue(null);

    const result = await broadcastNotification(userIds, input);

    expect(result).toHaveLength(2);
    expect(mockNotificationRepo.create).toHaveBeenNthCalledWith(1, {
      ...input,
      userId: "user-1",
    });
    expect(mockNotificationRepo.create).toHaveBeenNthCalledWith(2, {
      ...input,
      userId: "user-2",
    });
  });
});
