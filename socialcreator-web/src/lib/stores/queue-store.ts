/**
 * Queue Store
 * Queue monitoring state — status counts, job list, auto-refresh
 */

import { create } from "zustand";

export interface QueueJobItem {
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

export interface QueueStatusData {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
}

export interface QueueState {
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

export const useQueueStore = create<QueueState>()((set, get) => ({
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

      // Refresh the store after retry
      await get().fetchStatus();
      await get().fetchJobs();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to retry job" });
    }
  },

  setAutoRefresh: (enabled) => set({ autoRefresh: enabled }),
}));
