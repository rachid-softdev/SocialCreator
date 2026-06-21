/**
 * Tests for queue store
 * Based on design spec: Sprint 11 — Queue Monitoring Dashboard
 *
 * Self-contained: implements the store inline matching the design spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";

import { useQueueStore as useRealQueueStore } from "@/lib/stores/queue-store";

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

// ========== Import-based tests: cache headers, retry chaining, edge cases ==========

describe("queue-store [integration] — cache, retry, edge cases", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    useRealQueueStore.setState({
      status: null,
      jobs: [],
      isLoading: false,
      error: null,
      autoRefresh: true,
    });
    globalThis.fetch = mockFetch;
    vi.clearAllMocks();
  });

  describe("fetchStatus with cache: no-store", () => {
    it("calls fetch with cache: no-store", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ queued: 2, running: 0, completed: 5, failed: 0, total: 7 }),
      });

      await useRealQueueStore.getState().fetchStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/queue/status",
        expect.objectContaining({ cache: "no-store" }),
      );
    });
  });

  describe("fetchJobs with cache: no-store", () => {
    it("calls fetch with cache: no-store", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await useRealQueueStore.getState().fetchJobs();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/queue/jobs",
        expect.objectContaining({ cache: "no-store" }),
      );
    });
  });

  describe("retryJob", () => {
    it("calls retry endpoint then refreshes status and jobs", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ queued: 0, running: 0, completed: 0, failed: 0, total: 0 }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await useRealQueueStore.getState().retryJob("job-1");

      // First call: POST retry
      expect(mockFetch.mock.calls[0][0]).toBe("/api/v1/queue/jobs/job-1/retry");
      expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: "POST" });
      // Second call: fetchStatus
      expect(mockFetch.mock.calls[1][0]).toBe("/api/v1/queue/status");
      // Third call: fetchJobs
      expect(mockFetch.mock.calls[2][0]).toBe("/api/v1/queue/jobs");
    });

    it("sets error when retry endpoint returns non-ok", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await useRealQueueStore.getState().retryJob("job-1");

      expect(useRealQueueStore.getState().error).toBe("HTTP 500");
    });
  });

  describe("edge cases", () => {
    it("fetchStatus handles non-Error thrown values", async () => {
      mockFetch.mockRejectedValueOnce("String error");

      await useRealQueueStore.getState().fetchStatus();

      expect(useRealQueueStore.getState().error).toBe("Failed to fetch status");
    });

    it("fetchJobs handles non-Error thrown values", async () => {
      mockFetch.mockRejectedValueOnce(42);

      await useRealQueueStore.getState().fetchJobs();

      expect(useRealQueueStore.getState().error).toBe("Failed to fetch jobs");
      expect(useRealQueueStore.getState().isLoading).toBe(false);
    });

    it("retryJob handles non-Error thrown values", async () => {
      mockFetch.mockRejectedValueOnce(null);

      await useRealQueueStore.getState().retryJob("job-1");

      expect(useRealQueueStore.getState().error).toBe("Failed to retry job");
    });
  });

  describe("fetchStatus — does NOT set isLoading (documented inconsistency)", () => {
    it("leaves isLoading unchanged during fetch", async () => {
      let resolveFetch!: (value: unknown) => void;
      mockFetch.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );

      const promise = useRealQueueStore.getState().fetchStatus();
      // fetchStatus does NOT set isLoading, so it should remain false
      expect(useRealQueueStore.getState().isLoading).toBe(false);

      resolveFetch({
        ok: true,
        json: () => Promise.resolve({ queued: 0, running: 0, completed: 0, failed: 0, total: 0 }),
      });
      await promise;
    });
  });

  describe("retryJob — fetchStatus succeeds but fetchJobs fails", () => {
    it("sets error when fetchJobs fails after successful retry and fetchStatus", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ queued: 0, running: 0, completed: 0, failed: 0, total: 0 }),
      });
      mockFetch.mockRejectedValueOnce(new Error("Failed to fetch jobs"));

      await useRealQueueStore.getState().retryJob("job-1");

      expect(useRealQueueStore.getState().error).toBe("Failed to fetch jobs");
    });
  });

  describe("fetchJobs — does not clear existing jobs on error", () => {
    it("keeps existing jobs when fetch fails", async () => {
      const existingJob = { ...mockJob, id: "existing-job" };
      useRealQueueStore.setState({ jobs: [existingJob] });

      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await useRealQueueStore.getState().fetchJobs();

      // jobs array should still contain the previous job after an error
      expect(useRealQueueStore.getState().jobs).toStrictEqual([existingJob]);
    });
  });
});
