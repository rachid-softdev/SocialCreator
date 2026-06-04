/**
 * Tests for agent store
 * Based on design spec: docs/architecture/06-zustand-stores.md
 *
 * Self-contained: implements the store inline matching the design spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";
import { mockAgent, mockAgentRun } from "@/lib/__tests__/__shared__/test-fixtures";
import { useAgentStore as useRealAgentStore } from "@/lib/stores/agent-store";

// ========== Inline types and store matching the design spec ==========

interface AgentRun {
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

interface Agent {
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

interface AgentState {
  agents: Agent[];
  runs: Record<string, AgentRun[]>;
  selectedAgentId: string | null;
  selectedRunId: string | null;
  isLoading: boolean;
  isRunning: boolean;
  error: string | null;
  selectAgent: (id: string | null) => void;
  selectRun: (id: string | null) => void;
  updateRunStatus: (agentId: string, runId: string, status: AgentRun["status"]) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;
  reset: () => void;
}

const useAgentStore = create<AgentState>()((set) => ({
  agents: [],
  runs: {},
  selectedAgentId: null,
  selectedRunId: null,
  isLoading: false,
  isRunning: false,
  error: null,
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
      isLoading: false,
      isRunning: false,
      error: null,
    }),
}));

// ========== Tests ==========

describe("AgentStore", () => {
  const mockAgent: Agent = {
    id: "agent-1",
    profileId: "profile-1",
    name: "Content Bot",
    type: "content",
    platforms: ["X", "INSTAGRAM"],
    isActive: true,
    autoPublish: false,
    scheduleCron: null,
    maxPerDay: 5,
    runCount: 3,
    latestRun: { status: "SUCCESS", createdAt: "2024-01-01T00:00:00Z" },
    createdAt: "2024-01-01T00:00:00Z",
  };

  const mockAgent2: Agent = {
    ...mockAgent,
    id: "agent-2",
    name: "Image Bot",
    type: "image",
    platforms: ["INSTAGRAM"],
    isActive: false,
  };

  const mockRun: AgentRun = {
    id: "run-1",
    agentId: "agent-1",
    brief: "Generate post about AI",
    status: "SUCCESS",
    startedAt: "2024-01-01T10:00:00Z",
    finishedAt: "2024-01-01T10:05:00Z",
    error: null,
    contentCount: 3,
    createdAt: "2024-01-01T10:00:00Z",
  };

  const mockRun2: AgentRun = {
    ...mockRun,
    id: "run-2",
    status: "RUNNING",
    startedAt: "2024-01-02T10:00:00Z",
    finishedAt: null,
  };

  beforeEach(() => {
    useAgentStore.setState({
      agents: [],
      runs: {},
      selectedAgentId: null,
      selectedRunId: null,
      isLoading: false,
      isRunning: false,
      error: null,
    });
  });

  describe("initial state", () => {
    it("should start with empty agents array", () => {
      expect(useAgentStore.getState().agents).toStrictEqual([]);
    });

    it("should start with empty runs map", () => {
      expect(useAgentStore.getState().runs).toStrictEqual({});
    });

    it("should start with no selection", () => {
      expect(useAgentStore.getState().selectedAgentId).toBeNull();
      expect(useAgentStore.getState().selectedRunId).toBeNull();
    });
  });

  describe("selectAgent", () => {
    it("should set selectedAgentId", () => {
      useAgentStore.getState().selectAgent("agent-1");
      expect(useAgentStore.getState().selectedAgentId).toBe("agent-1");
    });

    it("should clear selectedRunId when selecting an agent", () => {
      useAgentStore.setState({ selectedRunId: "run-1" });
      useAgentStore.getState().selectAgent("agent-1");

      expect(useAgentStore.getState().selectedRunId).toBeNull();
    });

    it("should set selectedAgentId to null", () => {
      useAgentStore.setState({ selectedAgentId: "agent-1" });
      useAgentStore.getState().selectAgent(null);

      expect(useAgentStore.getState().selectedAgentId).toBeNull();
    });
  });

  describe("selectRun", () => {
    it("should set selectedRunId", () => {
      useAgentStore.getState().selectRun("run-1");
      expect(useAgentStore.getState().selectedRunId).toBe("run-1");
    });

    it("should set selectedRunId to null", () => {
      useAgentStore.setState({ selectedRunId: "run-1" });
      useAgentStore.getState().selectRun(null);

      expect(useAgentStore.getState().selectedRunId).toBeNull();
    });

    it("should not affect selectedAgentId", () => {
      useAgentStore.setState({ selectedAgentId: "agent-1" });
      useAgentStore.getState().selectRun("run-1");

      expect(useAgentStore.getState().selectedAgentId).toBe("agent-1");
    });
  });

  describe("updateRunStatus", () => {
    it("should update status of a specific run", () => {
      useAgentStore.setState({ runs: { "agent-1": [mockRun] } });
      useAgentStore.getState().updateRunStatus("agent-1", "run-1", "FAILED");

      const run = useAgentStore.getState().runs["agent-1"][0];
      expect(run.status).toBe("FAILED");
    });

    it("should do nothing if agentId has no runs", () => {
      useAgentStore.getState().updateRunStatus("nonexistent", "run-1", "FAILED");

      expect(useAgentStore.getState().runs).toStrictEqual({});
    });

    it("should do nothing if runId not found in agent's runs", () => {
      useAgentStore.setState({ runs: { "agent-1": [mockRun] } });
      useAgentStore.getState().updateRunStatus("agent-1", "nonexistent", "FAILED");

      expect(useAgentStore.getState().runs["agent-1"][0].status).toBe("SUCCESS");
    });

    it("should not affect other runs of the same agent", () => {
      useAgentStore.setState({ runs: { "agent-1": [mockRun, mockRun2] } });
      useAgentStore.getState().updateRunStatus("agent-1", "run-1", "FAILED");

      const runs = useAgentStore.getState().runs["agent-1"];
      expect(runs[0].status).toBe("FAILED");
      expect(runs[1].status).toBe("RUNNING");
    });
  });

  describe("updateAgent", () => {
    it("should update agent fields by id", () => {
      useAgentStore.setState({ agents: [mockAgent] });
      useAgentStore.getState().updateAgent("agent-1", { name: "Updated Bot", maxPerDay: 10 });

      const agent = useAgentStore.getState().agents[0];
      expect(agent.name).toBe("Updated Bot");
      expect(agent.maxPerDay).toBe(10);
      expect(agent.type).toBe("content"); // unchanged
    });

    it("should do nothing if agent id not found", () => {
      useAgentStore.setState({ agents: [mockAgent] });
      useAgentStore.getState().updateAgent("nonexistent", { name: "Nope" });

      expect(useAgentStore.getState().agents).toHaveLength(1);
    });

    it("should not affect other agents", () => {
      useAgentStore.setState({ agents: [mockAgent, mockAgent2] });
      useAgentStore.getState().updateAgent("agent-1", { isActive: false });

      expect(useAgentStore.getState().agents[0].isActive).toBe(false);
    });
  });

  describe("removeAgent", () => {
    it("should remove agent by id", () => {
      useAgentStore.setState({ agents: [mockAgent, mockAgent2] });
      useAgentStore.getState().removeAgent("agent-1");

      expect(useAgentStore.getState().agents).toHaveLength(1);
      expect(useAgentStore.getState().agents[0].id).toBe("agent-2");
    });

    it("should do nothing if id not found", () => {
      useAgentStore.setState({ agents: [mockAgent] });
      useAgentStore.getState().removeAgent("nonexistent");

      expect(useAgentStore.getState().agents).toHaveLength(1);
    });
  });

  describe("reset", () => {
    it("should clear all state", () => {
      useAgentStore.setState({
        agents: [mockAgent],
        runs: { "agent-1": [mockRun] },
        selectedAgentId: "agent-1",
        selectedRunId: "run-1",
        error: "some error",
      });

      useAgentStore.getState().reset();

      const state = useAgentStore.getState();
      expect(state.agents).toStrictEqual([]);
      expect(state.runs).toStrictEqual({});
      expect(state.selectedAgentId).toBeNull();
      expect(state.selectedRunId).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe("isLoading / isRunning", () => {
    it("should start as false", () => {
      expect(useAgentStore.getState().isLoading).toBe(false);
      expect(useAgentStore.getState().isRunning).toBe(false);
    });

    it("should be settable via setState", () => {
      useAgentStore.setState({ isLoading: true });
      expect(useAgentStore.getState().isLoading).toBe(true);

      useAgentStore.setState({ isRunning: true });
      expect(useAgentStore.getState().isRunning).toBe(true);
    });

    it("should reset to false", () => {
      useAgentStore.setState({ isLoading: true, isRunning: true });
      useAgentStore.getState().reset();

      expect(useAgentStore.getState().isLoading).toBe(false);
      expect(useAgentStore.getState().isRunning).toBe(false);
    });
  });
});

// ========== Import-based tests: async operations ==========

describe("agent-store [integration] — fetchAgents, fetchRuns, runAgent", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    useRealAgentStore.setState({
      agents: [],
      runs: {},
      selectedAgentId: null,
      selectedRunId: null,
      isLoading: false,
      isRunning: false,
      error: null,
    });
    globalThis.fetch = mockFetch;
    vi.clearAllMocks();
  });

  describe("fetchAgents", () => {
    const profileId = "profile-1";

    it("sets agents and isLoading false on success", async () => {
      const agents = [mockAgent];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents }),
      });

      await useRealAgentStore.getState().fetchAgents(profileId);

      expect(useRealAgentStore.getState().agents).toStrictEqual(agents);
      expect(useRealAgentStore.getState().isLoading).toBe(false);
      expect(useRealAgentStore.getState().error).toBeNull();
    });

    it("sets error on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await useRealAgentStore.getState().fetchAgents(profileId);

      expect(useRealAgentStore.getState().error).toBe("HTTP 500");
      expect(useRealAgentStore.getState().isLoading).toBe(false);
    });

    it("sets error when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await useRealAgentStore.getState().fetchAgents(profileId);

      expect(useRealAgentStore.getState().error).toBe("Network error");
      expect(useRealAgentStore.getState().isLoading).toBe(false);
    });

    it("calls the correct URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents: [] }),
      });

      await useRealAgentStore.getState().fetchAgents(profileId);

      expect(mockFetch).toHaveBeenCalledWith(`/api/v1/agents?profileId=${profileId}`);
    });
  });

  describe("fetchRuns", () => {
    const agentId = "agent-1";

    it("adds runs to map keyed by agentId on success", async () => {
      const runs = [mockAgentRun];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runs }),
      });

      await useRealAgentStore.getState().fetchRuns(agentId);

      expect(useRealAgentStore.getState().runs[agentId]).toStrictEqual(runs);
    });

    it("sets error when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await useRealAgentStore.getState().fetchRuns(agentId);

      expect(useRealAgentStore.getState().error).toBe("Network error");
    });

    it("calls the correct URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runs: [] }),
      });

      await useRealAgentStore.getState().fetchRuns(agentId);

      expect(mockFetch).toHaveBeenCalledWith(`/api/v1/agents/${agentId}/runs`);
    });
  });

  describe("runAgent", () => {
    const agentId = "agent-1";

    it("returns runId and sets isRunning false on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runId: "run-1" }),
      });

      // also mock the subsequent fetchRuns call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runs: [] }),
      });

      const runId = await useRealAgentStore.getState().runAgent(agentId);

      expect(runId).toBe("run-1");
      expect(useRealAgentStore.getState().isRunning).toBe(false);
    });

    it("throws and sets isRunning false on failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Run failed"));

      await expect(useRealAgentStore.getState().runAgent(agentId)).rejects.toThrow("Run failed");

      expect(useRealAgentStore.getState().isRunning).toBe(false);
      expect(useRealAgentStore.getState().error).toBe("Run failed");
    });

    it("calls POST endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runId: "run-1" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runs: [] }),
      });

      await useRealAgentStore.getState().runAgent(agentId);

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/agents/${agentId}/run`,
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("sync actions", () => {
    it("selectAgent sets selectedAgentId and clears selectedRunId", () => {
      useRealAgentStore.setState({ selectedRunId: "run-1" });
      useRealAgentStore.getState().selectAgent("agent-1");

      expect(useRealAgentStore.getState().selectedAgentId).toBe("agent-1");
      expect(useRealAgentStore.getState().selectedRunId).toBeNull();
    });

    it("selectRun sets selectedRunId", () => {
      useRealAgentStore.getState().selectRun("run-1");

      expect(useRealAgentStore.getState().selectedRunId).toBe("run-1");
    });

    it("updateRunStatus updates specific run in runs map", () => {
      useRealAgentStore.setState({ runs: { "agent-1": [mockAgentRun] } });
      useRealAgentStore.getState().updateRunStatus("agent-1", "run-1", "FAILED");

      expect(useRealAgentStore.getState().runs["agent-1"][0].status).toBe("FAILED");
    });

    it("updateAgent updates agent in agents array", () => {
      useRealAgentStore.setState({ agents: [mockAgent] });
      useRealAgentStore.getState().updateAgent("agent-1", {
        name: "Updated Agent",
      });

      expect(useRealAgentStore.getState().agents[0].name).toBe("Updated Agent");
    });

    it("removeAgent removes from agents array", () => {
      useRealAgentStore.setState({ agents: [mockAgent] });
      useRealAgentStore.getState().removeAgent("agent-1");

      expect(useRealAgentStore.getState().agents).toStrictEqual([]);
    });

    it("reset clears all state", () => {
      useRealAgentStore.setState({
        agents: [mockAgent],
        runs: { "agent-1": [mockAgentRun] },
        selectedAgentId: "agent-1",
        error: "some error",
      });

      useRealAgentStore.getState().reset();

      const state = useRealAgentStore.getState();
      expect(state.agents).toStrictEqual([]);
      expect(state.runs).toStrictEqual({});
      expect(state.selectedAgentId).toBeNull();
      expect(state.selectedRunId).toBeNull();
      expect(state.error).toBeNull();
    });
  });
});
