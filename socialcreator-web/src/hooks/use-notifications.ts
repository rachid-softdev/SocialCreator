/**
 * Notifications Hook
 * Connects to SSE for real-time notifications with polling fallback
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

interface UseNotificationsReturn {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL = 30_000; // 30 seconds polling fallback

/**
 * Hook for real-time notifications with SSE + polling fallback
 */
export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/notifications?pageSize=50");
      if (!response.ok) throw new Error("Failed to fetch notifications");
      const data = await response.json();
      setNotifications(data.notifications || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch notifications");
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/notifications/unread-count");
      if (!response.ok) throw new Error("Failed to fetch unread count");
      const data = await response.json();
      setUnreadCount(data.count || 0);
    } catch {
      // Silently fail — count is not critical
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchNotifications(), fetchUnreadCount()]);
    setLoading(false);
  }, [fetchNotifications, fetchUnreadCount]);

  // Set up SSE connection
  useEffect(() => {
    let mounted = true;

    const setupSSE = () => {
      try {
        const es = new EventSource("/api/v1/notifications/stream");
        eventSourceRef.current = es;

        es.addEventListener("connected", () => {
          if (mounted) {
            setError(null);
            refresh();
          }
        });

        es.addEventListener("notification", (event) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === "new_notification" && data.notification) {
              setNotifications((prev) => [data.notification, ...prev]);
              setUnreadCount((prev) => prev + 1);
            }
          } catch {
            // Ignore parse errors
          }
        });

        es.addEventListener("keepalive", () => {
          // Keepalive received — connection is alive, no action needed
        });

        es.onerror = () => {
          // SSE connection error — close and rely on polling
          if (mounted) {
            es.close();
            eventSourceRef.current = null;
          }
        };
      } catch {
        // SSE not supported — polling will handle it
      }
    };

    // Set up polling as fallback
    const setupPolling = () => {
      pollIntervalRef.current = setInterval(() => {
        if (mounted) {
          fetchUnreadCount();
        }
      }, POLL_INTERVAL);
    };

    setupSSE();
    setupPolling();

    // Initial load
    refresh();

    return () => {
      mounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [refresh, fetchUnreadCount]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/v1/notifications/${id}/read`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark as read");
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/notifications/read-all", {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to mark all as read");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark all as read");
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refresh,
  };
}
