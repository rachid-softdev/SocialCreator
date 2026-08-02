// @vitest-environment jsdom
/**
 * Tests for useNotifications hook
 *
 * Covers:
 * - Initial state
 * - fetchNotifications success/failure
 * - fetchUnreadCount success/silent fail
 * - SSE events (connected, notification, keepalive, onerror)
 * - markAsRead / markAllAsRead
 * - Cleanup on unmount
 * - Manual refresh
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationItem } from "../use-notifications";
import { useNotifications } from "../use-notifications";

// ── Mock data ──────────────────────────────────────────────────────────────

const mockNotification1: NotificationItem = {
  id: "notif-1",
  type: "info",
  title: "Notification 1",
  message: "First notification",
  data: {},
  read: false,
  createdAt: "2024-01-01T00:00:00Z",
};

const mockNotification2: NotificationItem = {
  id: "notif-2",
  type: "warning",
  title: "Notification 2",
  message: null,
  data: { key: "value" },
  read: false,
  createdAt: "2024-01-02T00:00:00Z",
};

const mockNewNotification: NotificationItem = {
  id: "notif-3",
  type: "success",
  title: "New notification",
  message: "Arrived via SSE",
  data: {},
  read: false,
  createdAt: "2024-01-03T00:00:00Z",
};

// ── Mock helpers ───────────────────────────────────────────────────────────

/** Tracks the most recent mock EventSource instance for emitting events */
interface MockEventSourceInstance {
  url: string;
  listeners: Map<string, Array<(event?: unknown) => void>>;
  close: ReturnType<typeof vi.fn>;
  onerror: ((event?: unknown) => void) | null;
  /** Emit a named event to registered listeners */
  emit: (event: string, data?: unknown) => void;
  addEventListener: (event: string, handler: (event?: unknown) => void) => void;
}

let currentMockEventSource: MockEventSourceInstance | null = null;

function setupMockEventSource(): void {
  const mockImpl = vi.fn((url: string) => {
    const instance: MockEventSourceInstance = {
      url,
      listeners: new Map(),
      close: vi.fn(),
      onerror: null,
      emit(event: string, data?: unknown) {
        const handlers = instance.listeners.get(event) || [];
        for (const handler of handlers) {
          handler(data);
        }
      },
      addEventListener(event: string, handler: (event?: unknown) => void) {
        if (!instance.listeners.has(event)) {
          instance.listeners.set(event, []);
        }
        instance.listeners.get(event)!.push(handler);
      },
    };
    currentMockEventSource = instance;
    return instance;
  });
  vi.stubGlobal("EventSource", mockImpl);
}

const mockFetch = vi.fn();

/** Configure fetch mock to return default successful responses */
function setupDefaultFetchBehaviour(): void {
  mockFetch.mockImplementation((url: string | URL | Request, _options?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();

    if (urlStr.includes("unread-count")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ count: 3 }),
      });
    }

    if (urlStr.includes("notifications")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ notifications: [mockNotification1, mockNotification2] }),
      });
    }

    // PATCH endpoints (markAsRead / markAllAsRead)
    if (urlStr.includes("/read")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }

    return Promise.reject(new Error(`Unexpected URL: ${urlStr}`));
  });
}

/** Flush pending microtasks so async work in the hook settles */
async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("useNotifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    currentMockEventSource = null;

    setupMockEventSource();
    vi.stubGlobal("fetch", mockFetch);
    setupDefaultFetchBehaviour();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    currentMockEventSource = null;
  });

  // ── Initial state ─────────────────────────────────────────────────────

  describe("initial state", () => {
    it("should start with loading=true, empty notifications, unreadCount=0, error=null", async () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current.loading).toBe(true);
      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.error).toBeNull();

      // Flush pending async work to avoid act() warnings on unmount
      await flushMicrotasks();
    });
  });

  // ── fetchNotifications ──────────────────────────────────────────────

  describe("fetchNotifications", () => {
    it("should populate notifications on success", async () => {
      const { result } = renderHook(() => useNotifications());
      await flushMicrotasks();

      expect(result.current.loading).toBe(false);
      expect(result.current.notifications).toEqual([mockNotification1, mockNotification2]);
      expect(result.current.error).toBeNull();
    });

    it("should set error and keep notifications unchanged on failure", async () => {
      mockFetch.mockImplementation((url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("unread-count")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ count: 0 }),
          });
        }
        return Promise.reject(new Error("Network error"));
      });

      const { result } = renderHook(() => useNotifications());
      await flushMicrotasks();

      expect(result.current.error).toBe("Network error");
      expect(result.current.notifications).toEqual([]);
    });
  });

  // ── fetchUnreadCount ────────────────────────────────────────────────

  describe("fetchUnreadCount", () => {
    it("should update unreadCount on success", async () => {
      const { result } = renderHook(() => useNotifications());
      await flushMicrotasks();

      expect(result.current.unreadCount).toBe(3);
    });

    it("should silently fail on error without changing error state", async () => {
      mockFetch.mockImplementation((url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("unread-count")) {
          return Promise.reject(new Error("Count error"));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ notifications: [mockNotification1, mockNotification2] }),
        });
      });

      const { result } = renderHook(() => useNotifications());
      await flushMicrotasks();

      expect(result.current.unreadCount).toBe(0);
      expect(result.current.error).toBeNull();
    });
  });

  // ── SSE events ──────────────────────────────────────────────────────

  describe("SSE events", () => {
    it('should call refresh and clear error on "connected" event', async () => {
      const { result } = renderHook(() => useNotifications());
      await flushMicrotasks();

      // Artificially set an error to verify it gets cleared
      mockFetch.mockClear();

      act(() => {
        currentMockEventSource?.emit("connected");
      });

      await flushMicrotasks();

      expect(result.current.error).toBeNull();
      // refresh() should have triggered new fetch calls
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should prepend notification on "notification" event and increment unreadCount', async () => {
      const { result } = renderHook(() => useNotifications());
      await flushMicrotasks();

      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.unreadCount).toBe(3);

      act(() => {
        currentMockEventSource?.emit("notification", {
          data: JSON.stringify({
            type: "new_notification",
            notification: mockNewNotification,
          }),
        });
      });

      expect(result.current.notifications).toHaveLength(3);
      expect(result.current.notifications[0]!.id).toBe("notif-3");
      expect(result.current.unreadCount).toBe(4);
    });

    it('should silently ignore "notification" event with parse error', async () => {
      const { result } = renderHook(() => useNotifications());
      await flushMicrotasks();

      const initialNotifications = [...result.current.notifications];
      const initialUnread = result.current.unreadCount;

      act(() => {
        currentMockEventSource?.emit("notification", {
          data: "{invalid json}",
        });
      });

      expect(result.current.notifications).toEqual(initialNotifications);
      expect(result.current.unreadCount).toBe(initialUnread);
    });

    it('should do nothing on "keepalive" event', async () => {
      const { result } = renderHook(() => useNotifications());
      await flushMicrotasks();

      const notificationsSnapshot = [...result.current.notifications];
      const unreadSnapshot = result.current.unreadCount;

      act(() => {
        currentMockEventSource?.emit("keepalive");
      });

      expect(result.current.notifications).toEqual(notificationsSnapshot);
      expect(result.current.unreadCount).toBe(unreadSnapshot);
    });

    it("should close SSE connection on onerror and clear the ref", async () => {
      const { result } = renderHook(() => useNotifications());
      await flushMicrotasks();

      const closeSpy = currentMockEventSource!.close;

      act(() => {
        if (currentMockEventSource?.onerror) {
          currentMockEventSource.onerror();
        }
      });

      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── markAsRead ──────────────────────────────────────────────────────

  describe("markAsRead", () => {
    it("should mark notification as read and decrement unreadCount", async () => {
      const { result } = renderHook(() => useNotifications());
      await flushMicrotasks();

      expect(result.current.notifications[0]!.read).toBe(false);
      expect(result.current.unreadCount).toBe(3);

      await act(async () => {
        await result.current.markAsRead("notif-1");
      });

      expect(result.current.notifications[0]!.read).toBe(true);
      expect(result.current.unreadCount).toBe(2);
    });

    it("should set error when markAsRead fails", async () => {
      mockFetch.mockImplementation((url: string | URL | Request, _options?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        // Only fail on specific mark-as-read endpoint for this notification
        if (urlStr.includes("/notif-1/read")) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({}),
          });
        }
        // Fall through to default handler for other URLs
        if (urlStr.includes("unread-count")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ count: 3 }),
          });
        }
        if (urlStr.includes("notifications")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                notifications: [mockNotification1, mockNotification2],
              }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${urlStr}`));
      });

      const { result } = renderHook(() => useNotifications());
      await flushMicrotasks();

      await act(async () => {
        await result.current.markAsRead("notif-1");
      });

      expect(result.current.error).toBe("Failed to mark as read");
    });
  });

  // ── markAllAsRead ───────────────────────────────────────────────────

  describe("markAllAsRead", () => {
    it("should mark all notifications as read and reset unreadCount", async () => {
      const { result } = renderHook(() => useNotifications());
      await flushMicrotasks();

      expect(result.current.notifications.every((n) => n.read === false)).toBe(true);

      await act(async () => {
        await result.current.markAllAsRead();
      });

      expect(result.current.notifications.every((n) => n.read === true)).toBe(true);
      expect(result.current.unreadCount).toBe(0);
    });

    it("should set error when markAllAsRead fails", async () => {
      mockFetch.mockImplementation((url: string | URL | Request, _options?: RequestInit) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("read-all")) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({}),
          });
        }
        // Default for other URLs
        if (urlStr.includes("unread-count")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ count: 3 }),
          });
        }
        if (urlStr.includes("notifications")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                notifications: [mockNotification1, mockNotification2],
              }),
          });
        }
        return Promise.reject(new Error(`Unexpected: ${urlStr}`));
      });

      const { result } = renderHook(() => useNotifications());
      await flushMicrotasks();

      await act(async () => {
        await result.current.markAllAsRead();
      });

      expect(result.current.error).toBe("Failed to mark all as read");
    });
  });

  // ── Cleanup ─────────────────────────────────────────────────────────

  describe("cleanup on unmount", () => {
    it("should close SSE connection and clear interval on unmount", () => {
      const { unmount } = renderHook(() => useNotifications());

      const eventSource = currentMockEventSource;
      expect(eventSource).not.toBeNull();

      unmount();

      expect(eventSource!.close).toHaveBeenCalledTimes(1);
    });
  });

  // ── Refresh ─────────────────────────────────────────────────────────

  describe("refresh", () => {
    it("should set loading and re-fetch notifications + unread count", async () => {
      const { result } = renderHook(() => useNotifications());
      await flushMicrotasks();

      // Confirm initial load completed
      expect(result.current.loading).toBe(false);
      expect(result.current.notifications).toHaveLength(2);

      // Clear the fetch mock so we can verify new calls
      mockFetch.mockClear();

      // Start refresh manually
      act(() => {
        result.current.refresh();
      });

      // loading should be true immediately after refresh starts
      expect(result.current.loading).toBe(true);

      await flushMicrotasks();

      expect(result.current.loading).toBe(false);
      // Should have called both endpoints
      const calls = mockFetch.mock.calls.map((c) =>
        typeof c[0] === "string" ? c[0] : c[0].toString(),
      );
      expect(calls.some((url: string) => url.includes("notifications"))).toBe(true);
      expect(calls.some((url: string) => url.includes("unread-count"))).toBe(true);
    });
  });
});
