/**
 * Integration tests for notification API routes
 *
 * Tests:
 * - GET /api/v1/notifications — paginated list
 * - GET /api/v1/notifications/unread-count — unread count
 * - PATCH /api/v1/notifications/[id]/read — mark one as read
 * - PATCH /api/v1/notifications/read-all — mark all as read
 */

import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit-redis", () => ({ withRateLimit: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock withApiMiddleware as a pass-through
vi.mock("@/lib/api-middleware", () => {
  const withApiMiddleware = (handler: (ctx: any, params?: any) => Promise<NextResponse>) => {
    return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
      const resolvedParams = context?.params ? await context.params : {};
      return handler(
        { userId: "user-abc-123", request, apiVersion: "v1", params: resolvedParams },
        resolvedParams,
      );
    };
  };
  return { withApiMiddleware };
});

// Repository mocks
const mockRepos = {
  notification: {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    countUnread: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => mockRepos),
}));

// ---------------------------------------------------------------------------
// Import routes
// ---------------------------------------------------------------------------

import { PATCH as NotificationReadPATCH } from "@/app/api/v1/notifications/[id]/read/route";
import { PATCH as ReadAllPATCH } from "@/app/api/v1/notifications/read-all/route";
import { GET as NotificationsGET } from "@/app/api/v1/notifications/route";
import { GET as UnreadCountGET } from "@/app/api/v1/notifications/unread-count/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  path: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> },
): NextRequest {
  const url = `http://localhost:3000${path}`;
  const body = options?.body !== undefined ? JSON.stringify(options.body) : undefined;
  return new NextRequest(url, {
    method: options?.method ?? "GET",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body,
  });
}

function createParams(params: Record<string, string>): { params: Promise<Record<string, string>> } {
  return { params: Promise.resolve(params) };
}

const mockNotification = {
  id: "notif-1",
  userId: "user-abc-123",
  type: "test",
  title: "Test Notification",
  message: "Hello",
  data: {},
  read: false,
  createdAt: new Date("2026-06-03T12:00:00Z"),
};

const mockNotificationPage = {
  notifications: [mockNotification],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/v1/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return paginated notification list", async () => {
    mockRepos.notification.findByUserId.mockResolvedValue(mockNotificationPage);

    const res = await NotificationsGET(createRequest("/api/v1/notifications"), createParams({}));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.notifications).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });

  it("should pass pagination parameters from query string", async () => {
    mockRepos.notification.findByUserId.mockResolvedValue({
      ...mockNotificationPage,
      page: 2,
      pageSize: 10,
    });

    await NotificationsGET(
      createRequest("/api/v1/notifications?page=2&pageSize=10"),
      createParams({}),
    );

    expect(mockRepos.notification.findByUserId).toHaveBeenCalledWith("user-abc-123", {
      page: 2,
      pageSize: 10,
      unreadOnly: undefined,
    });
  });

  it("should pass unreadOnly filter when set", async () => {
    mockRepos.notification.findByUserId.mockResolvedValue({
      ...mockNotificationPage,
      notifications: [{ ...mockNotification, read: false }],
    });

    await NotificationsGET(
      createRequest("/api/v1/notifications?unreadOnly=true"),
      createParams({}),
    );

    expect(mockRepos.notification.findByUserId).toHaveBeenCalledWith("user-abc-123", {
      page: 1,
      pageSize: 20,
      unreadOnly: true,
    });
  });

  it("should return empty list when no notifications", async () => {
    mockRepos.notification.findByUserId.mockResolvedValue({
      notifications: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });

    const res = await NotificationsGET(createRequest("/api/v1/notifications"), createParams({}));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.notifications).toHaveLength(0);
    expect(data.total).toBe(0);
  });
});

describe("GET /api/v1/notifications/unread-count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return unread count", async () => {
    mockRepos.notification.countUnread.mockResolvedValue(5);

    const res = await UnreadCountGET(
      createRequest("/api/v1/notifications/unread-count"),
      createParams({}),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(5);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });

  it("should return zero when no unread notifications", async () => {
    mockRepos.notification.countUnread.mockResolvedValue(0);

    const res = await UnreadCountGET(
      createRequest("/api/v1/notifications/unread-count"),
      createParams({}),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(0);
  });
});

describe("PATCH /api/v1/notifications/[id]/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should mark notification as read", async () => {
    mockRepos.notification.findById.mockResolvedValue(mockNotification);
    mockRepos.notification.markAsRead.mockResolvedValue({
      ...mockNotification,
      read: true,
    });

    const res = await NotificationReadPATCH(
      createRequest("/api/v1/notifications/notif-1/read", { method: "PATCH" }),
      createParams({ id: "notif-1" }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.notification.read).toBe(true);
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });

  it("should return 404 when notification not found", async () => {
    mockRepos.notification.findById.mockResolvedValue(null);

    const res = await NotificationReadPATCH(
      createRequest("/api/v1/notifications/unknown/read", { method: "PATCH" }),
      createParams({ id: "unknown" }),
    );

    expect(res.status).toBe(404);
  });

  it("should return 401 when notification belongs to another user", async () => {
    mockRepos.notification.findById.mockResolvedValue({
      ...mockNotification,
      userId: "other-user",
    });

    const res = await NotificationReadPATCH(
      createRequest("/api/v1/notifications/notif-1/read", { method: "PATCH" }),
      createParams({ id: "notif-1" }),
    );

    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/v1/notifications/read-all", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should mark all notifications as read and return count", async () => {
    mockRepos.notification.markAllAsRead.mockResolvedValue(3);

    const res = await ReadAllPATCH(
      createRequest("/api/v1/notifications/read-all", { method: "PATCH" }),
      createParams({}),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updatedCount).toBe(3);
    expect(mockRepos.notification.markAllAsRead).toHaveBeenCalledWith("user-abc-123");
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });

  it("should return zero when no unread notifications", async () => {
    mockRepos.notification.markAllAsRead.mockResolvedValue(0);

    const res = await ReadAllPATCH(
      createRequest("/api/v1/notifications/read-all", { method: "PATCH" }),
      createParams({}),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updatedCount).toBe(0);
  });
});
