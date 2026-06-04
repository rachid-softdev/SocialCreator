/**
 * Tests for agent execution service (execute.ts)
 *
 * Covers executeAgentRun: generates content for each platform in parallel
 * using the LLM and prompt builders.
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

vi.mock("@/lib/llm", () => ({
  generateContent: vi.fn(),
}));

vi.mock("@/lib/prompts", () => ({
  buildSystemPrompt: vi.fn().mockReturnValue("system prompt"),
  buildGenerationPrompt: vi.fn().mockReturnValue("generation prompt"),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { generateContent } from "@/lib/llm";
import { buildGenerationPrompt, buildSystemPrompt } from "@/lib/prompts";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("executeAgentRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be a function", async () => {
    const { executeAgentRun } = await import("../execute");
    expect(typeof executeAgentRun).toBe("function");
  });

  it("should generate content for all platforms in parallel", async () => {
    vi.mocked(generateContent).mockResolvedValue({
      textContent: "Generated content",
      hashtags: ["#test"],
      hook: "Hook line",
    });

    const { executeAgentRun } = await import("../execute");
    const results = await executeAgentRun(mockAgent as any, "Test brief");

    expect(results).toHaveLength(2);
    expect(results[0].platform).toBe("INSTAGRAM");
    expect(results[1].platform).toBe("LINKEDIN");
    expect(results[0].textContent).toBe("Generated content");
    expect(results[1].hashtags).toEqual(["#test"]);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("should pass system prompt with brand voice to LLM", async () => {
    vi.mocked(generateContent).mockResolvedValue({
      textContent: "Content",
      hashtags: [],
    });

    const { executeAgentRun } = await import("../execute");
    await executeAgentRun(mockAgent as any, "Brief");

    expect(buildSystemPrompt).toHaveBeenCalledTimes(1);
    expect(buildSystemPrompt).toHaveBeenCalledWith({
      name: mockAgent.profile.name,
      brandVoice: mockAgent.profile.brandVoice,
      contentBank: mockAgent.profile.contentBank,
    });
  });

  it("should pass platform-specific generation prompt for each platform", async () => {
    vi.mocked(generateContent).mockResolvedValue({
      textContent: "Content",
      hashtags: [],
    });

    const { executeAgentRun } = await import("../execute");
    await executeAgentRun(mockAgent as any, "Test brief");

    expect(buildGenerationPrompt).toHaveBeenCalledTimes(2);
    expect(buildGenerationPrompt).toHaveBeenCalledWith({
      brief: "Test brief",
      platform: "INSTAGRAM",
    });
    expect(buildGenerationPrompt).toHaveBeenCalledWith({
      brief: "Test brief",
      platform: "LINKEDIN",
    });
  });

  it("should propagate LLM errors", async () => {
    vi.mocked(generateContent).mockRejectedValue(new Error("LLM API error"));

    const { executeAgentRun } = await import("../execute");
    await expect(executeAgentRun(mockAgent as any, "Brief")).rejects.toThrow("LLM API error");
  });

  it("should handle single platform gracefully", async () => {
    const singlePlatformAgent = {
      ...mockAgent,
      platforms: ["X"],
    };
    vi.mocked(generateContent).mockResolvedValue({
      textContent: "X post",
      hashtags: ["#x"],
    });

    const { executeAgentRun } = await import("../execute");
    const results = await executeAgentRun(singlePlatformAgent as any, "Brief");

    expect(results).toHaveLength(1);
    expect(results[0].platform).toBe("X");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("should include hook in result when LLM returns it", async () => {
    vi.mocked(generateContent).mockResolvedValue({
      textContent: "Post with hook",
      hashtags: ["#hook"],
      hook: "Amazing statistic!",
    });

    const { executeAgentRun } = await import("../execute");
    const results = await executeAgentRun(mockAgent as any, "Brief");

    expect(results[0].hook).toBe("Amazing statistic!");
  });

  it("should handle empty hashtags array from LLM", async () => {
    vi.mocked(generateContent).mockResolvedValue({
      textContent: "No hashtags",
      hashtags: [],
    });

    const { executeAgentRun } = await import("../execute");
    const results = await executeAgentRun(mockAgent as any, "Brief");

    expect(results[0].hashtags).toEqual([]);
  });
});
