/**
 * Tests for the Agent Runner orchestrator
 *
 * Covers the full pipeline:
 * - validate.ts: agent existence + CGU check
 * - execute.ts: LLM content generation per platform
 * - persist.ts: run status updates + content storage
 * - index.ts (triggerAgentRun): end-to-end orchestrator
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Hoisted mocks — vitest hoists vi.mock() calls,
// so all mock data must go through vi.hoisted()
// ============================================

const { mockPrisma, mockAgent, mockRun, mockGenerationResults } = vi.hoisted(() => {
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

  const generationData = [
    { platform: "INSTAGRAM", textContent: "Instagram post", hashtags: ["#ai"], hook: "Amazing!" },
    {
      platform: "LINKEDIN",
      textContent: "LinkedIn article",
      hashtags: ["#tech"],
      hook: "Insight:",
    },
  ];

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
    mockAgent: agentData,
    mockRun: runData,
    mockGenerationResults: generationData,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/llm", () => ({
  generateContent: vi.fn(),
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
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { generateContent } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { contentGenerated } from "@/lib/utils/metrics";

// ============================================
// Tests: validate.ts
// ============================================

describe("Agent Runner - validate.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateAgentRun", () => {
    it("should return agent when CGU is accepted", async () => {
      vi.mocked(prisma.agent.findUnique).mockResolvedValue(mockAgent as any);

      const { validateAgentRun } = await import("../services/agent/validate");
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
    });

    it("should throw when agent not found", async () => {
      vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);

      const { validateAgentRun } = await import("../services/agent/validate");
      await expect(validateAgentRun("agent-nonexistent", "run-1")).rejects.toThrow(
        "Agent not found",
      );
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

      const { validateAgentRun } = await import("../services/agent/validate");
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
  });
});

// ============================================
// Tests: execute.ts
// ============================================

describe("Agent Runner - execute.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeAgentRun", () => {
    it("should generate content for all platforms in parallel", async () => {
      vi.mocked(generateContent).mockResolvedValue({
        textContent: "Test content",
        hashtags: ["#test"],
        hook: "Hook",
      });

      const { executeAgentRun } = await import("../services/agent/execute");
      const results = await executeAgentRun(mockAgent as any, "Test brief");

      expect(results).toHaveLength(2);
      expect(results[0].platform).toBe("INSTAGRAM");
      expect(results[1].platform).toBe("LINKEDIN");
      expect(generateContent).toHaveBeenCalledTimes(2);
    });

    it("should pass system prompt with brand voice to LLM", async () => {
      vi.mocked(generateContent).mockResolvedValue({
        textContent: "Content",
        hashtags: [],
      });

      const { executeAgentRun } = await import("../services/agent/execute");
      await executeAgentRun(mockAgent as any, "Brief");

      // Verify buildSystemPrompt would have been called with profile data
      const { buildSystemPrompt } = await import("@/lib/prompts");
      expect(buildSystemPrompt).toHaveBeenCalledWith({
        name: mockAgent.profile.name,
        brandVoice: mockAgent.profile.brandVoice,
        contentBank: mockAgent.profile.contentBank,
      });
    });

    it("should propagate LLM errors", async () => {
      vi.mocked(generateContent).mockRejectedValue(new Error("LLM API error"));

      const { executeAgentRun } = await import("../services/agent/execute");
      await expect(executeAgentRun(mockAgent as any, "Brief")).rejects.toThrow("LLM API error");
    });
  });
});

// ============================================
// Tests: persist.ts
// ============================================

describe("Agent Runner - persist.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("markRunRunning", () => {
    it("should update status to RUNNING with startedAt", async () => {
      vi.mocked(prisma.agentRun.update).mockResolvedValue({} as any);

      const { markRunRunning } = await import("../services/agent/persist");
      await markRunRunning("run-1");

      expect(prisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-1" },
        data: { status: "RUNNING", startedAt: expect.any(Date) },
      });
    });
  });

  describe("markRunSuccess", () => {
    it("should update status to SUCCESS with finishedAt", async () => {
      vi.mocked(prisma.agentRun.update).mockResolvedValue({} as any);

      const { markRunSuccess } = await import("../services/agent/persist");
      await markRunSuccess("run-1");

      expect(prisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-1" },
        data: { status: "SUCCESS", finishedAt: expect.any(Date) },
      });
    });
  });

  describe("markRunFailed", () => {
    it("should update status to FAILED with error message", async () => {
      vi.mocked(prisma.agentRun.update).mockResolvedValue({} as any);

      const { markRunFailed } = await import("../services/agent/persist");
      await markRunFailed("run-1", "Something went wrong");

      expect(prisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-1" },
        data: { status: "FAILED", finishedAt: expect.any(Date), error: "Something went wrong" },
      });
    });
  });

  describe("saveGeneratedContent", () => {
    it("should save content in a transaction with DRAFT status", async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        if (typeof fn === "function") {
          return fn(prisma);
        }
        return fn;
      });
      vi.mocked(prisma.generatedContent.create).mockResolvedValue({} as any);

      const { saveGeneratedContent } = await import("../services/agent/persist");
      await saveGeneratedContent("run-1", "profile-1", mockGenerationResults);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.generatedContent.create).toHaveBeenCalledTimes(2);
      expect(prisma.generatedContent.create).toHaveBeenCalledWith({
        data: {
          runId: "run-1",
          profileId: "profile-1",
          platform: "INSTAGRAM",
          textContent: "Instagram post",
          hashtags: ["#ai"],
          mediaUrls: [],
          status: "DRAFT",
        },
      });

      // Metrics should be incremented for each generated content
      expect(contentGenerated.inc).toHaveBeenCalledTimes(4);
      expect(contentGenerated.inc).toHaveBeenCalledWith({
        platform: "instagram",
        type: "text",
      });
      expect(contentGenerated.inc).toHaveBeenCalledWith({
        platform: "linkedin",
        type: "text",
      });
      expect(contentGenerated.inc).toHaveBeenCalledWith({
        platform: "instagram",
        type: "agent",
      });
      expect(contentGenerated.inc).toHaveBeenCalledWith({
        platform: "linkedin",
        type: "agent",
      });
    });

    it("should handle empty results gracefully", async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([]);

      const { saveGeneratedContent } = await import("../services/agent/persist");
      await expect(saveGeneratedContent("run-1", "profile-1", [])).resolves.not.toThrow();

      // No metrics should be incremented for empty results
      expect(contentGenerated.inc).not.toHaveBeenCalled();
    });
  });
});

// ============================================
// Tests: index.ts (triggerAgentRun orchestrator)
// ============================================

describe("Agent Runner - triggerAgentRun (orchestrator)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock setup for happy path
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(mockAgent as any);
    vi.mocked(prisma.agentRun.update).mockResolvedValue({} as any);
    vi.mocked(prisma.agentRun.findUnique).mockResolvedValue(mockRun as any);
    vi.mocked(generateContent).mockResolvedValue({
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

  it("should complete the full pipeline successfully", async () => {
    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).resolves.not.toThrow();

    // Validate was called
    expect(prisma.agent.findUnique).toHaveBeenCalled();

    // Mark running
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({ status: "RUNNING" }),
      }),
    );

    // Execute was called
    expect(generateContent).toHaveBeenCalledTimes(2); // 2 platforms

    // Persist was called
    expect(prisma.$transaction).toHaveBeenCalled();

    // Mark success
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({ status: "SUCCESS" }),
      }),
    );

    // Metrics: contentGenerated.inc should be called (from saveGeneratedContent)
    expect(contentGenerated.inc).toHaveBeenCalled();
    // agentRunDuration.observe should be called on success
    const { agentRunDuration } = await import("@/lib/utils/metrics");
    expect(agentRunDuration.observe).toHaveBeenCalledWith(
      { status: "success" },
      expect.any(Number),
    );
  });

  it("should mark run as FAILED when execution throws", async () => {
    vi.mocked(generateContent).mockRejectedValue(new Error("LLM timeout"));

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).rejects.toThrow(
      "LLM timeout",
    );

    // Should have marked as FAILED
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          error: "LLM timeout",
        }),
      }),
    );

    // Metrics: agentRunDuration.observe should be called with failed status
    const { agentRunDuration } = await import("@/lib/utils/metrics");
    expect(agentRunDuration.observe).toHaveBeenCalledWith({ status: "failed" }, expect.any(Number));
  });

  it("should soft-fail when CGU not accepted (returns null)", async () => {
    const agentNoCgu = {
      ...mockAgent,
      profile: {
        ...mockAgent.profile,
        user: { cguAccepted: false },
      },
    };
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(agentNoCgu as any);

    const { triggerAgentRun } = await import("../services/agent/index");
    // Should NOT throw - soft fail per the code comment "soft fail (CGU not accepted)"
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).resolves.not.toThrow();

    // Should NOT proceed to execute or save
    expect(generateContent).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();

    // No metrics should be incremented
    expect(contentGenerated.inc).not.toHaveBeenCalled();
    const { agentRunDuration } = await import("@/lib/utils/metrics");
    expect(agentRunDuration.observe).not.toHaveBeenCalled();
  });

  it("should throw when run is not found after marking running", async () => {
    vi.mocked(prisma.agentRun.findUnique).mockResolvedValue(null);

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "nonexistent" })).rejects.toThrow(
      "Run not found",
    );
  });

  it("should handle agent with 0 platforms (empty array)", async () => {
    const agentNoPlatforms = { ...mockAgent, platforms: [] };
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(agentNoPlatforms as any);

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).resolves.not.toThrow();

    // LLM not called
    expect(generateContent).not.toHaveBeenCalled();
    // Transaction still called (with empty array)
    expect(prisma.$transaction).toHaveBeenCalled();
    // Mark success
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS" }),
      }),
    );
  });

  it("should handle empty textContent from LLM", async () => {
    vi.mocked(generateContent).mockResolvedValue({
      textContent: "",
      hashtags: [],
      hook: "",
    });

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).resolves.not.toThrow();

    // Content saved with empty text
    expect(prisma.generatedContent.create).toHaveBeenCalledTimes(2);
    expect(prisma.generatedContent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ textContent: "" }),
      }),
    );
    // Success
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS" }),
      }),
    );
  });

  it("should handle all 8 platforms configured", async () => {
    const eightPlatforms = [
      "INSTAGRAM",
      "TIKTOK",
      "LINKEDIN",
      "YOUTUBE",
      "X",
      "FACEBOOK",
      "THREADS",
      "PINTEREST",
    ];
    const agentAllPlatforms = { ...mockAgent, platforms: eightPlatforms };
    vi.mocked(prisma.agent.findUnique).mockResolvedValue(agentAllPlatforms as any);

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).resolves.not.toThrow();

    expect(generateContent).toHaveBeenCalledTimes(8);
    expect(prisma.generatedContent.create).toHaveBeenCalledTimes(8);
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS" }),
      }),
    );
  });

  it("should mark FAILED when markRunSuccess throws after content saved", async () => {
    // Make SUCCESS update throw
    vi.mocked(prisma.agentRun.update)
      .mockResolvedValueOnce({} as any) // markRunRunning
      .mockRejectedValueOnce(new Error("Success update failed")); // markRunSuccess

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).rejects.toThrow(
      "Success update failed",
    );

    // Content was saved despite markRunSuccess failure
    expect(prisma.generatedContent.create).toHaveBeenCalledTimes(2);

    // Should have called markRunFailed with the success error
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          error: "Success update failed",
        }),
      }),
    );

    // agentRunDuration should be called with failed status (not success)
    const { agentRunDuration } = await import("@/lib/utils/metrics");
    expect(agentRunDuration.observe).toHaveBeenCalledWith({ status: "failed" }, expect.any(Number));
  });

  it("should handle non-Error throwable (string) in catch block gracefully", async () => {
    vi.mocked(generateContent).mockRejectedValue("raw string error" as any);

    const { triggerAgentRun } = await import("../services/agent/index");
    // The catch block re-throws the ORIGINAL error (the string), not "Unknown error"
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).rejects.toBe(
      "raw string error",
    );

    // But markRunFailed uses "Unknown error" since it's not an Error instance
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          error: "Unknown error",
        }),
      }),
    );

    const { agentRunDuration } = await import("@/lib/utils/metrics");
    expect(agentRunDuration.observe).toHaveBeenCalledWith({ status: "failed" }, expect.any(Number));
  });

  it("should not record success metrics when run fails", async () => {
    vi.mocked(generateContent).mockRejectedValue(new Error("LLM failure"));

    const { triggerAgentRun } = await import("../services/agent/index");
    await expect(triggerAgentRun({ agentId: "agent-1", runId: "run-1" })).rejects.toThrow(
      "LLM failure",
    );

    const { agentRunDuration } = await import("@/lib/utils/metrics");

    // Should only observe with "failed" status, not "success"
    expect(agentRunDuration.observe).not.toHaveBeenCalledWith(
      { status: "success" },
      expect.any(Number),
    );
    expect(agentRunDuration.observe).toHaveBeenCalledWith({ status: "failed" }, expect.any(Number));
  });
});
