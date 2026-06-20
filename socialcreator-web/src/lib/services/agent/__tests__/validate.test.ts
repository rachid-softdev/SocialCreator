/**
 * Tests for agent validation service (validate.ts)
 *
 * Covers validateAgentRun: checks agent exists and CGU is accepted.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockAgent = {
  id: "agent-1",
  name: "Test Agent",
  profileId: "profile-1",
  platforms: ["INSTAGRAM", "LINKEDIN"],
  maxPerDay: 4,
  isActive: true,
  profile: {
    id: "profile-1",
    name: "Test Brand",
    brandVoice: "Professional and helpful",
    contentBank: "Previous content",
    userId: "user-1",
    user: { cguAccepted: true },
  },
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: {
      findUnique: vi.fn(),
    },
    agentRun: {
      update: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validateAgentRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be a function", async () => {
    const { validateAgentRun } = await import("../validate");
    expect(typeof validateAgentRun).toBe("function");
  });

  it("should return agent when CGU is accepted", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(mockAgent as any);

    const { validateAgentRun } = await import("../validate");
    const result = await validateAgentRun("agent-1", "run-1");

    expect(result).toEqual(mockAgent);
    expect(prisma.agent.findUnique).toHaveBeenCalledWith({
      where: { id: "agent-1" },
      include: {
        profile: {
          include: {
            user: { select: { cguAccepted: true } },
          },
        },
      },
    });
    expect(prisma.agentRun.update).not.toHaveBeenCalled();
  });

  it("should throw when agent is not found", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);

    const { validateAgentRun } = await import("../validate");
    await expect(validateAgentRun("nonexistent-agent", "run-1")).rejects.toThrow("Agent not found");
  });

  it("should mark run as FAILED and return null when CGU not accepted", async () => {
    const agentNoCgu = {
      ...mockAgent,
      profile: {
        ...mockAgent.profile,
        user: { cguAccepted: false },
      },
    };
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(agentNoCgu as any);
    vi.mocked(prisma.agentRun.update).mockResolvedValue({} as any);

    const { validateAgentRun } = await import("../validate");
    const result = await validateAgentRun("agent-1", "run-1");

    expect(result).toBeNull();
    expect(prisma.agentRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: {
        status: "FAILED",
        finishedAt: expect.any(Date),
        error: "CGU acceptance required to run agents",
      },
    });
  });

  it("should throw when Prisma query fails", async () => {
    vi.mocked(prisma.agent.findUnique).mockRejectedValue(new Error("Database connection lost"));

    const { validateAgentRun } = await import("../validate");
    await expect(validateAgentRun("agent-1", "run-1")).rejects.toThrow("Database connection lost");
  });

  it("should throw when profile is missing from agent result", async () => {
    const agentWithoutProfile = {
      id: "agent-1",
      name: "No Profile Agent",
      profileId: "profile-nonexistent",
      platforms: ["X"],
      maxPerDay: 2,
      isActive: true,
      profile: null,
    };
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(agentWithoutProfile as any);

    const { validateAgentRun } = await import("../validate");
    await expect(validateAgentRun("agent-1", "run-1")).rejects.toThrow();
  });

  it("should propagate error when prisma.agentRun.update fails during CGU soft-fail", async () => {
    const agentNoCgu = {
      ...mockAgent,
      profile: {
        ...mockAgent.profile,
        user: { cguAccepted: false },
      },
    };
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(agentNoCgu as any);
    vi.mocked(prisma.agentRun.update).mockRejectedValue(new Error("Database write timeout"));

    const { validateAgentRun } = await import("../validate");
    await expect(validateAgentRun("agent-1", "run-1")).rejects.toThrow("Database write timeout");
  });
});
