/**
 * Agent Store
 * Agents list, run states, execution tracking
 */

import { create } from "zustand";

export interface AgentRun {
  id: string;
  agentId: string;
  brief: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  contentCount: number;
  createdAt: string;
}

export interface Agent {
  id: string;
  profileId: string;
  name: string;
  type: string;
  platforms: string[];
  isActive: boolean;
  autoPublish: boolean;
  scheduleCron: string | null;
  maxPerDay: number;
  runCount: number;
  latestRun?: { status: string; createdAt: string };
  createdAt: string;
}

export interface AgentState {
  agents: Agent[];
  runs: Record<string, AgentRun[]>;
  selectedAgentId: string | null;
  selectedRunId: string | null;
  isLoading: boolean;
  isRunning: boolean;
  error: string | null;
  fetchAgents: (profileId: string) => Promise<void>;
  fetchRuns: (agentId: string) => Promise<void>;
  runAgent: (agentId: string) => Promise<string>;
  selectAgent: (id: string | null) => void;
  selectRun: (id: string | null) => void;
  updateRunStatus: (agentId: string, runId: string, status: AgentRun["status"]) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>()((set, get) => ({
  agents: [],
  runs: {},
  selectedAgentId: null,
  selectedRunId: null,
  isLoading: false,
  isRunning: false,
  error: null,

  fetchAgents: async (profileId) => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch(`/api/v1/agents?profileId=${profileId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      set({ agents: data.agents ?? data, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch agents",
        isLoading: false,
      });
    }
  },

  fetchRuns: async (agentId) => {
    try {
      const res = await fetch(`/api/v1/agents/${agentId}/runs`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      set((state) => ({
        runs: { ...state.runs, [agentId]: data.runs ?? data },
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch runs",
      });
    }
  },

  runAgent: async (agentId) => {
    set({ isRunning: true });

    try {
      const res = await fetch(`/api/v1/agents/${agentId}/run`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      get().fetchRuns(agentId);
      set({ isRunning: false });

      return data.runId;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to run agent",
        isRunning: false,
      });
      throw err;
    }
  },

  // Note: isRunning is always reset in both success and error paths via the
  // set({ isRunning: false }) calls above. On network errors (fetch throws),
  // the catch block ensures isRunning is reset. On HTTP errors (!res.ok),
  // the try block throws into the catch block, same graceful reset.

  selectAgent: (id) => set({ selectedAgentId: id, selectedRunId: null }),
  selectRun: (id) => set({ selectedRunId: id }),

  updateRunStatus: (agentId, runId, status) =>
    set((state) => {
      const agentRuns = state.runs[agentId];
      if (!agentRuns) return state;

      return {
        runs: {
          ...state.runs,
          [agentId]: agentRuns.map((r) => (r.id === runId ? { ...r, status } : r)),
        },
      };
    }),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),

  removeAgent: (id) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
    })),

  reset: () =>
    set({
      agents: [],
      runs: {},
      selectedAgentId: null,
      selectedRunId: null,
      error: null,
    }),
}));
