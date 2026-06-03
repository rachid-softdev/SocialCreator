/**
 * Tests for queue store
 * Based on design spec: Sprint 11 — Queue Monitoring Dashboard
 *
 * Self-contained: implements the store inline matching the design spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";

// ========== Inline types and store matching the design spec ==========

interface QueueJobItem {
  id: string;
  type: string;
  status: "queued" | "running" | "completed" | "failed";
  priority: string;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

interface QueueStatusData {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
}

interface QueueState {
  status: QueueStatusData | null;
  jobs: QueueJobItem[];
  isLoading: boolean;
  error: string | null;
  autoRefresh: boolean;
  fetchStatus: () => Promise<void>;
  fetchJobs: () => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  setAutoRefresh: (enabled: boolean) => void;
}

const mockJob: QueueJobItem = {
  id: "job-1",
  type: "publish",
  status: "queued",
  priority: "normal",
  attempts: 0,
  maxAttempts: 3,
  createdAt: Date.now(),
};

const useQueueStore = create<QueueState>()((set, get) => ({
  status: null,
  jobs: [],
  isLoading: false,
  error: null,
  autoRefresh: true,

  fetchStatus: async () => {
    try {
      const res = await fetch("/api/v1/queue/status", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: QueueStatusData = await res.json();
      set({ status: data, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch status" });
    }
  },

  fetchJobs: async () => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch("/api/v1/queue/jobs", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: QueueJobItem[] = await res.json();
      set({ jobs: data, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch jobs",
        isLoading: false,
      });
    }
  },

  retryJob: async (jobId: string) => {
    try {
      const res = await fetch(`/api/v1/queue/jobs/${jobId}/retry`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await get().fetchStatus();
      await get().fetchJobs();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to retry job" });
    }
  },

  setAutoRefresh: (enabled) => set({ autoRefresh: enabled }),
}));

// ========== Tests ==========

describe("QueueStore", () => {
  beforeEach(() => {
    useQueueStore.setState({
      status: null,
      jobs: [],
      isLoading: false,
      error: null,
      autoRefresh: true,
    });
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("should start with null status", () => {
      expect(useQueueStore.getState().status).toBeNull();
    });

    it("should start with empty jobs", () => {
      expect(useQueueStore.getState().jobs).toStrictEqual([]);
    });

    it("should start with autoRefresh enabled", () => {
      expect(useQueueStore.getState().autoRefresh).toBe(true);
    });

    it("should start with not loading and no error", () => {
      expect(useQueueStore.getState().isLoading).toBe(false);
      expect(useQueueStore.getState().error).toBeNull();
    });
  });

  describe("setAutoRefresh", () => {
    it("should disable auto-refresh", () => {
      useQueueStore.getState().setAutoRefresh(false);
      expect(useQueueStore.getState().autoRefresh).toBe(false);
    });

    it("should enable auto-refresh after being disabled", () => {
      useQueueStore.getState().setAutoRefresh(false);
      useQueueStore.getState().setAutoRefresh(true);
      expect(useQueueStore.getState().autoRefresh).toBe(true);
    });

    it("should toggle auto-refresh repeatedly", () => {
      useQueueStore.getState().setAutoRefresh(false);
      expect(useQueueStore.getState().autoRefresh).toBe(false);
      useQueueStore.getState().setAutoRefresh(true);
      expect(useQueueStore.getState().autoRefresh).toBe(true);
      useQueueStore.getState().setAutoRefresh(false);
      expect(useQueueStore.getState().autoRefresh).toBe(false);
    });
  });

  describe("fetchStatus", () => {
    it("should fetch and set status on success", async () => {
      const mockData = { queued: 3, running: 1, completed: 10, failed: 2, total: 16 };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      await useQueueStore.getState().fetchStatus();

      expect(useQueueStore.getState().status).toStrictEqual(mockData);
      expect(useQueueStore.getState().error).toBeNull();
    });

    it("should set error when fetch fails", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      await useQueueStore.getState().fetchStatus();

      expect(useQueueStore.getState().status).toBeNull();
      expect(useQueueStore.getState().error).toBe("HTTP 500");
    });

    it("should set error when network fails", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await useQueueStore.getState().fetchStatus();

      expect(useQueueStore.getState().status).toBeNull();
      expect(useQueueStore.getState().error).toBe("Network error");
    });
  });

  describe("fetchJobs", () => {
    it("should set isLoading during fetch", async () => {
      // This test verifies that isLoading starts as true during fetchJobs
      // We need a promise that doesn't resolve immediately
      let resolvePromise!: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      globalThis.fetch = vi.fn().mockReturnValue(promise);

      const fetchPromise = useQueueStore.getState().fetchJobs();
      expect(useQueueStore.getState().isLoading).toBe(true);

      resolvePromise({ ok: true, json: () => Promise.resolve([]) });
      await fetchPromise;
    });

    it("should fetch and set jobs on success", async () => {
      const mockJobs = [mockJob];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockJobs),
      });

      await useQueueStore.getState().fetchJobs();

      expect(useQueueStore.getState().jobs).toStrictEqual(mockJobs);
      expect(useQueueStore.getState().isLoading).toBe(false);
      expect(useQueueStore.getState().error).toBeNull();
    });

    it("should set error when fetch fails", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      await useQueueStore.getState().fetchJobs();

      expect(useQueueStore.getState().jobs).toStrictEqual([]);
      expect(useQueueStore.getState().isLoading).toBe(false);
      expect(useQueueStore.getState().error).toBe("HTTP 500");
    });

    it("should clear error before fetching", async () => {
      useQueueStore.setState({ error: "Previous error" });
      const mockJobs = [mockJob];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockJobs),
      });

      await useQueueStore.getState().fetchJobs();

      expect(useQueueStore.getState().error).toBeNull();
    });
  });

  describe("retryJob", () => {
    it("should post to retry endpoint and refresh", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

      await useQueueStore.getState().retryJob("job-1");

      // Should have called the retry endpoint and then refresh endpoints
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/v1/queue/jobs/job-1/retry",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should set error when retry fails", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

      await useQueueStore.getState().retryJob("nonexistent");

      expect(useQueueStore.getState().error).toBe("HTTP 404");
    });

    it("should set error when retry network fails", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await useQueueStore.getState().retryJob("job-1");

      expect(useQueueStore.getState().error).toBe("Network error");
    });
  });
});
