/**
 * Comprehensive tests for Agent Scheduler Trigger
 *
 * Covers:
 * - runAgentScheduler() — cron-based agent scheduling with due detection,
 *   error handling for invalid cron expressions and enqueue failures,
 *   edge cases like empty platforms
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (vi.hoisted ensures vars exist before vi.mock factory runs) ──────

const mockParseExpression = vi.hoisted(() => vi.fn());

vi.mock("cron-parser", () => ({
  default: { parseExpression: mockParseExpression },
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockEnqueueAgentRun = vi.hoisted(() => vi.fn());
vi.mock("@/lib/trigger-client", () => ({
  enqueueAgentRun: mockEnqueueAgentRun,
}));

const mockAgentFindMany = vi.hoisted(() => vi.fn());
const mockAgentRunCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: { findMany: mockAgentFindMany },
    agentRun: { create: mockAgentRunCreate },
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { runAgentScheduler } from "@/triggers/agent-scheduler.trigger";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent-1",
    name: "Test Agent",
    isActive: true,
    scheduleCron: "*/5 * * * *",
    platforms: ["INSTAGRAM", "TIKTOK"],
    profile: { id: "profile-1", name: "Test Profile", userId: "user-1" },
    runs: [],
    ...overrides,
  };
}

/**
 * Build a cron-parser interval that simulates a due agent.
 * All calls to next() return a date with the same hour/minute as $atTime.
 */
function makeDueInterval(atTime: Date) {
  return {
    next: vi.fn().mockReturnValue({
      value: { toDate: () => new Date(atTime) },
    }),
  };
}

/**
 * Build a cron-parser interval that simulates a non-due agent.
 * The first returned date is more than 60s in the future → loop breaks early.
 */
function makeNotDueInterval(fromTime: Date) {
  return {
    next: vi.fn().mockReturnValue({
      value: { toDate: () => new Date(fromTime.getTime() + 120_000) },
    }),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("runAgentScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // Scenario: SUCCESS - no active agents with schedules → 0 processed
  it("should return 0 when there are no active agents with schedules", async () => {
    mockAgentFindMany.mockResolvedValue([]);

    const result = await runAgentScheduler();

    expect(result).toEqual({ agentsProcessed: 0, runsTriggered: 0 });
    expect(mockAgentRunCreate).not.toHaveBeenCalled();
    expect(mockEnqueueAgentRun).not.toHaveBeenCalled();
  });

  // Scenario: SUCCESS - single agent due → run created + enqueued
  it("should trigger a run for a due agent", async () => {
    const now = new Date("2026-06-20T10:30:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const agent = makeMockAgent();
    mockAgentFindMany.mockResolvedValue([agent]);
    mockParseExpression.mockReturnValue(makeDueInterval(now));
    mockAgentRunCreate.mockResolvedValue({ id: "run-1" });
    mockEnqueueAgentRun.mockResolvedValue(undefined);

    const result = await runAgentScheduler();

    expect(result).toEqual({ agentsProcessed: 1, runsTriggered: 1 });

    expect(mockAgentRunCreate).toHaveBeenCalledWith({
      data: {
        agentId: "agent-1",
        brief: "Scheduled run for Test Agent",
        status: "PENDING",
      },
    });

    expect(mockEnqueueAgentRun).toHaveBeenCalledWith({
      agentId: "agent-1",
      runId: "run-1",
      userId: "user-1",
      profileId: "profile-1",
    });

    vi.useRealTimers();
  });

  // Scenario: SUCCESS - agent NOT due → runsTriggered = 0
  it("should skip agent that is not due", async () => {
    const now = new Date("2026-06-20T10:30:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const agent = makeMockAgent();
    mockAgentFindMany.mockResolvedValue([agent]);
    mockParseExpression.mockReturnValue(makeNotDueInterval(now));

    const result = await runAgentScheduler();

    expect(result).toEqual({ agentsProcessed: 1, runsTriggered: 0 });
    expect(mockAgentRunCreate).not.toHaveBeenCalled();
    expect(mockEnqueueAgentRun).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  // Scenario: ERROR - cron expression invalide → logged as warn, continue
  it("should log warning and continue when cron expression is invalid", async () => {
    const agent1 = makeMockAgent({ id: "agent-1" });
    const agent2 = makeMockAgent({ id: "agent-2" });
    mockAgentFindMany.mockResolvedValue([agent1, agent2]);

    // First agent's cron throws on parse, second is valid but not due
    mockParseExpression
      .mockImplementationOnce(() => {
        throw new Error("Bad cron expression");
      })
      .mockImplementationOnce(() => makeNotDueInterval(new Date()));

    const logger = (await import("@/lib/logger")).default;

    const result = await runAgentScheduler();

    expect(result).toEqual({ agentsProcessed: 2, runsTriggered: 0 });
    expect(logger.warn).toHaveBeenCalledWith(
      {
        agentId: "agent-1",
        scheduleCron: "*/5 * * * *",
        err: expect.any(Error),
      },
      "Invalid cron expression",
    );
    expect(mockAgentRunCreate).not.toHaveBeenCalled();
  });

  // Scenario: ERROR - enqueueAgentRun fails → logged as error, continue
  it("should log error and continue when enqueueAgentRun fails", async () => {
    const now = new Date("2026-06-20T10:30:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const agents = [
      makeMockAgent({ id: "agent-1", name: "Agent 1" }),
      makeMockAgent({ id: "agent-2", name: "Agent 2" }),
    ];
    mockAgentFindMany.mockResolvedValue(agents);

    // Both agents are due
    mockParseExpression.mockReturnValue(makeDueInterval(now));

    mockAgentRunCreate
      .mockResolvedValueOnce({ id: "run-1" })
      .mockResolvedValueOnce({ id: "run-2" });

    // First enqueue fails, second succeeds
    mockEnqueueAgentRun
      .mockRejectedValueOnce(new Error("Queue full"))
      .mockResolvedValueOnce(undefined);

    const logger = (await import("@/lib/logger")).default;

    const result = await runAgentScheduler();

    expect(result).toEqual({ agentsProcessed: 2, runsTriggered: 1 });
    expect(logger.error).toHaveBeenCalledWith(
      { agentId: "agent-1", err: expect.any(Error) },
      "Failed to trigger agent run",
    );
    expect(mockEnqueueAgentRun).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  // Scenario: SUCCESS - multiple agents (some due, some not) → correct counts
  it("should handle a mix of due and not-due agents", async () => {
    const now = new Date("2026-06-20T10:30:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const agents = [
      makeMockAgent({ id: "agent-1", name: "Due Agent" }),
      makeMockAgent({ id: "agent-2", name: "Not Due Agent" }),
      makeMockAgent({ id: "agent-3", name: "Due Agent 2" }),
    ];
    mockAgentFindMany.mockResolvedValue(agents);

    // First and third are due; second is not
    mockParseExpression
      .mockReturnValueOnce(makeDueInterval(now))
      .mockReturnValueOnce(makeNotDueInterval(now))
      .mockReturnValueOnce(makeDueInterval(now));

    mockAgentRunCreate
      .mockResolvedValueOnce({ id: "run-1" })
      .mockResolvedValueOnce({ id: "run-3" });

    mockEnqueueAgentRun.mockResolvedValue(undefined);

    const result = await runAgentScheduler();

    expect(result).toEqual({ agentsProcessed: 3, runsTriggered: 2 });
    expect(mockAgentRunCreate).toHaveBeenCalledTimes(2);
    expect(mockEnqueueAgentRun).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  // Scenario: EDGE - agent with empty platforms → skipped
  it("should skip a due agent with empty platforms", async () => {
    const now = new Date("2026-06-20T10:30:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const agent = makeMockAgent({ platforms: [] });
    mockAgentFindMany.mockResolvedValue([agent]);
    mockParseExpression.mockReturnValue(makeDueInterval(now));

    const result = await runAgentScheduler();

    expect(result).toEqual({ agentsProcessed: 1, runsTriggered: 0 });
    expect(mockAgentRunCreate).not.toHaveBeenCalled();
    expect(mockEnqueueAgentRun).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
