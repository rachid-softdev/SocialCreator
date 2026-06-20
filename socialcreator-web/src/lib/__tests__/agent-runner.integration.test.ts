/**
 * Integration tests for the Agent Runner orchestrator
 *
 * Tests the full agent run flow (validate → execute → persist) with
 * mocked dependencies including Anthropic SDK, Prisma, and logger.
 * No real database or LLM calls are made.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Hoisted mocks — vitest hoists vi.mock() calls
// ============================================

const { mockPrisma, mockGenerateContent, mockLogger } = vi.hoisted(() => {
  const agentData = {
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

  const runData = {
    id: "run-1",
    agentId: "agent-1",
    brief: "Create engaging content about AI",
    status: "PENDING",
    createdAt: new Date(),
  };

  return {
    mockPrisma: {
      agent: { findUnique: vi.fn() },
      agentRun: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      generatedContent: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    mockGenerateContent: vi.fn(),
    mockLogger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    mockAgent: agentData,
    mockRun: runData,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/llm", () => ({
  generateContent: mockGenerateContent,
}));

vi.mock("@/lib/prompts", () => ({
  buildSystemPrompt: vi.fn().mockReturnValue("system prompt"),
  buildGenerationPrompt: vi.fn().mockReturnValue("generation prompt"),
}));

vi.mock("@/lib/utils/metrics", () => ({
  agentRunDuration: { observe: vi.fn() },
  contentGenerated: { inc: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  default: mockLogger,
}));

import { prisma } from "@/lib/prisma";
import { contentGenerated } from "@/lib/utils/metrics";

describe("Agent Runner (Integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock setup for happy path
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
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
    } as any);

    vi.mocked(prisma.agentRun.update).mockResolvedValue({} as any);
    vi.mocked(prisma.agentRun.findUnique).mockResolvedValue({
      id: "run-1",
      agentId: "agent-1",
      brief: "Create engaging content about AI",
      status: "PENDING",
      createdAt: new Date(),
    } as any);

    vi.mocked(mockGenerateContent).mockResolvedValue({
      textContent: "Generated content",
      hashtags: ["#test"],
      hook: "Hook line",
    });

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      if (typeof fn === "function") {
        return fn(prisma);
      }
      return fn;
    });

    vi.mocked(prisma.generatedContent.create).mockResolvedValue({} as any);
  });

  // ============================================
  // Full successful flow
  // ============================================

  it("should complete the full agent run flow successfully", async () => {
    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).resolves.not.toThrow();

    // Validate step: agent was fetched with CGU check
    expect(prisma.agent.findUnique).toHaveBeenCalledTimes(1);
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

    // Mark running
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({ status: "RUNNING" }),
      }),
    );

    // Fetch run for brief
    expect(prisma.agentRun.findUnique).toHaveBeenCalledWith({
      where: { id: "run-1" },
    });

    // Execute: LLM called for each platform
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);

    // Persist: transaction was used
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // Content was created
    expect(prisma.generatedContent.create).toHaveBeenCalledTimes(2);

    // Mark success
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({ status: "SUCCESS" }),
      }),
    );

    // Metrics recorded
    expect(contentGenerated.inc).toHaveBeenCalled();
  });

  // ============================================
  // CGU not accepted → soft fail
  // ============================================

  it("should soft-fail when CGU is not accepted", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-1",
      name: "Test Agent",
      profileId: "profile-1",
      platforms: ["INSTAGRAM"],
      maxPerDay: 4,
      isActive: true,
      profile: {
        id: "profile-1",
        name: "Test Brand",
        brandVoice: "Voice",
        contentBank: null,
        userId: "user-1",
        user: { cguAccepted: false },
      },
    } as any);

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).resolves.not.toThrow();

    // Should mark run as FAILED with CGU error
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({
          status: "FAILED",
          error: "CGU acceptance required to run agents",
        }),
      }),
    );

    // Should NOT proceed to execute
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();

    // No content metrics
    expect(contentGenerated.inc).not.toHaveBeenCalled();
  });

  // ============================================
  // Agent not found
  // ============================================

  it("should throw when agent is not found", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-nonexistent", runId: "run-1" })).rejects.toThrow(
      "Agent not found",
    );

    // Should not proceed further
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  // ============================================
  // LLM execution failure
  // ============================================

  it("should mark run as FAILED when LLM execution fails", async () => {
    vi.mocked(mockGenerateContent).mockRejectedValue(new Error("Anthropic API timeout"));

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).rejects.toThrow(
      "Anthropic API timeout",
    );

    // Should mark as FAILED
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          error: "Anthropic API timeout",
        }),
      }),
    );

    // Logger should capture the error
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      "Agent run failed",
    );
  });

  // ============================================
  // Run not found after marking running
  // ============================================

  it("should throw when run is not found after marking running", async () => {
    vi.mocked(prisma.agentRun.findUnique).mockResolvedValue(null);

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-nonexistent" })).rejects.toThrow(
      "Run not found",
    );

    // Should still have marked as RUNNING
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RUNNING" }),
      }),
    );

    // Should NOT proceed to execute
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  // ============================================
  // Single platform agent
  // ============================================

  it("should handle agent with single platform", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-single",
      name: "Single Platform Agent",
      profileId: "profile-1",
      platforms: ["X"],
      maxPerDay: 10,
      isActive: true,
      profile: {
        id: "profile-1",
        name: "Test Brand",
        brandVoice: "Voice",
        contentBank: null,
        userId: "user-1",
        user: { cguAccepted: true },
      },
    } as any);

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(
      triggerAgentRun({ agentId: "agent-single", runId: "run-1" }),
    ).resolves.not.toThrow();

    // LLM called exactly once
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  // ============================================
  // Agent with zero platforms
  // ============================================

  it("should handle agent with 0 platforms (empty array)", async () => {
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-zero",
      name: "Zero Platform Agent",
      profileId: "profile-1",
      platforms: [],
      maxPerDay: 5,
      isActive: true,
      profile: {
        id: "profile-1",
        name: "Test Brand",
        brandVoice: "Voice",
        contentBank: null,
        userId: "user-1",
        user: { cguAccepted: true },
      },
    } as any);

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-zero", runId: "run-1" })).resolves.not.toThrow();

    // Validate step
    expect(prisma.agent.findUnique).toHaveBeenCalledTimes(1);

    // Mark running
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({ status: "RUNNING" }),
      }),
    );

    // LLM not called (no platforms)
    expect(mockGenerateContent).not.toHaveBeenCalled();

    // Transaction still called but with empty array
    expect(prisma.$transaction).toHaveBeenCalled();

    // Mark success
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({ status: "SUCCESS" }),
      }),
    );
  });

  // ============================================
  // Empty textContent from LLM
  // ============================================

  it("should handle empty textContent from LLM", async () => {
    vi.mocked(mockGenerateContent).mockResolvedValue({
      textContent: "",
      hashtags: [],
      hook: "",
    });

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).resolves.not.toThrow();

    // Content still saved and marked success
    expect(prisma.generatedContent.create).toHaveBeenCalledTimes(2);
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS" }),
      }),
    );
  });

  // ============================================
  // Non-Error throwables (string, object)
  // ============================================

  it("should handle non-Error throwable (string) from LLM", async () => {
    vi.mocked(mockGenerateContent).mockRejectedValue("Something went wrong" as any);

    const { triggerAgentRun } = await import("../services/agent/index");
    // The catch block re-throws the original error (the string), not "Unknown error"
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).rejects.toBe(
      "Something went wrong",
    );

    // But markRunFailed is called with "Unknown error" since it's not an Error instance
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          error: "Unknown error",
        }),
      }),
    );
  });

  // ============================================
  // All 8 platforms configured
  // ============================================

  it("should generate content for all 8 platforms", async () => {
    const allPlatforms = [
      "INSTAGRAM",
      "TIKTOK",
      "LINKEDIN",
      "YOUTUBE",
      "X",
      "FACEBOOK",
      "THREADS",
      "PINTEREST",
    ];
    vi.mocked(prisma.agent.findUnique).mockResolvedValue({
      id: "agent-all",
      name: "All Platforms Agent",
      profileId: "profile-1",
      platforms: allPlatforms,
      maxPerDay: 10,
      isActive: true,
      profile: {
        id: "profile-1",
        name: "Test Brand",
        brandVoice: "Voice",
        contentBank: null,
        userId: "user-1",
        user: { cguAccepted: true },
      },
    } as any);

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-all", runId: "run-1" })).resolves.not.toThrow();

    // LLM called 8 times (one per platform)
    expect(mockGenerateContent).toHaveBeenCalledTimes(8);

    // 8 content items created
    expect(prisma.generatedContent.create).toHaveBeenCalledTimes(8);

    // Mark success
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS" }),
      }),
    );
  });

  // ============================================
  // markRunSuccess fails after content saved
  // ============================================

  it("should mark FAILED when markRunSuccess throws after content saved", async () => {
    // Reset and set explicit call chain: markRunRunning → OK, markRunSuccess → throws, markRunFailed → OK
    vi.mocked(prisma.agentRun.update).mockReset();
    vi.mocked(prisma.agentRun.update)
      .mockResolvedValueOnce({} as any) // markRunRunning
      .mockRejectedValueOnce(new Error("Failed to update status to SUCCESS")) // markRunSuccess (throws)
      .mockResolvedValueOnce({} as any); // markRunFailed (catch)

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).rejects.toThrow(
      "Failed to update status to SUCCESS",
    );

    // Content was still saved despite markRunSuccess failure
    expect(prisma.generatedContent.create).toHaveBeenCalledTimes(2);

    // Run marked FAILED with the markRunSuccess error
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          error: "Failed to update status to SUCCESS",
        }),
      }),
    );
  });
});
