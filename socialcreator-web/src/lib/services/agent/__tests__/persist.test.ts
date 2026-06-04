/**
 * Tests for agent persistence service (persist.ts)
 *
 * Covers markRunRunning, saveGeneratedContent, markRunSuccess, markRunFailed
 * including Prisma transactions and Prometheus metrics.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockGenerationResults = [
  { platform: "INSTAGRAM", textContent: "Instagram post", hashtags: ["#ai"], hook: "Amazing!" },
  {
    platform: "LINKEDIN",
    textContent: "LinkedIn article",
    hashtags: ["#tech"],
    hook: "Insight:",
  },
];

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentRun: {
      update: vi.fn(),
    },
    generatedContent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/utils/metrics", () => ({
  contentGenerated: { inc: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { contentGenerated } from "@/lib/utils/metrics";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Agent persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("markRunRunning", () => {
    it("should be a function", async () => {
      const { markRunRunning } = await import("../persist");
      expect(typeof markRunRunning).toBe("function");
    });

    it("should update status to RUNNING with startedAt", async () => {
      vi.mocked(prisma.agentRun.update).mockResolvedValue({} as any);

      const { markRunRunning } = await import("../persist");
      await markRunRunning("run-1");

      expect(prisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-1" },
        data: { status: "RUNNING", startedAt: expect.any(Date) },
      });
    });

    it("should throw when Prisma update fails", async () => {
      vi.mocked(prisma.agentRun.update).mockRejectedValue(new Error("Database error"));

      const { markRunRunning } = await import("../persist");
      await expect(markRunRunning("run-1")).rejects.toThrow("Database error");
    });
  });

  describe("markRunSuccess", () => {
    it("should be a function", async () => {
      const { markRunSuccess } = await import("../persist");
      expect(typeof markRunSuccess).toBe("function");
    });

    it("should update status to SUCCESS with finishedAt", async () => {
      vi.mocked(prisma.agentRun.update).mockResolvedValue({} as any);

      const { markRunSuccess } = await import("../persist");
      await markRunSuccess("run-1");

      expect(prisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-1" },
        data: { status: "SUCCESS", finishedAt: expect.any(Date) },
      });
    });

    it("should throw when Prisma update fails", async () => {
      vi.mocked(prisma.agentRun.update).mockRejectedValue(new Error("Write conflict"));

      const { markRunSuccess } = await import("../persist");
      await expect(markRunSuccess("run-1")).rejects.toThrow("Write conflict");
    });
  });

  describe("markRunFailed", () => {
    it("should be a function", async () => {
      const { markRunFailed } = await import("../persist");
      expect(typeof markRunFailed).toBe("function");
    });

    it("should update status to FAILED with error message and finishedAt", async () => {
      vi.mocked(prisma.agentRun.update).mockResolvedValue({} as any);

      const { markRunFailed } = await import("../persist");
      await markRunFailed("run-1", "Something went wrong");

      expect(prisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-1" },
        data: {
          status: "FAILED",
          finishedAt: expect.any(Date),
          error: "Something went wrong",
        },
      });
    });

    it("should handle empty error string", async () => {
      vi.mocked(prisma.agentRun.update).mockResolvedValue({} as any);

      const { markRunFailed } = await import("../persist");
      await markRunFailed("run-1", "");

      expect(prisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-1" },
        data: expect.objectContaining({ error: "" }),
      });
    });
  });

  describe("saveGeneratedContent", () => {
    it("should be a function", async () => {
      const { saveGeneratedContent } = await import("../persist");
      expect(typeof saveGeneratedContent).toBe("function");
    });

    it("should save content in a transaction with DRAFT status and increment metrics", async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        if (typeof fn === "function") {
          return fn(prisma);
        }
        return fn;
      });
      vi.mocked(prisma.generatedContent.create).mockResolvedValue({} as any);

      const { saveGeneratedContent } = await import("../persist");
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
      expect(prisma.generatedContent.create).toHaveBeenCalledWith({
        data: {
          runId: "run-1",
          profileId: "profile-1",
          platform: "LINKEDIN",
          textContent: "LinkedIn article",
          hashtags: ["#tech"],
          mediaUrls: [],
          status: "DRAFT",
        },
      });

      // Metrics should be incremented for each generated content (2 types per platform)
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

      const { saveGeneratedContent } = await import("../persist");
      await expect(saveGeneratedContent("run-1", "profile-1", [])).resolves.not.toThrow();

      expect(prisma.generatedContent.create).not.toHaveBeenCalled();
      expect(contentGenerated.inc).not.toHaveBeenCalled();
    });

    it("should default to empty array when hashtags is undefined", async () => {
      const resultsWithoutHashtags = [
        {
          platform: "X",
          textContent: "Post without tags",
          hashtags: undefined,
        },
      ];

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        if (typeof fn === "function") {
          return fn(prisma);
        }
        return fn;
      });
      vi.mocked(prisma.generatedContent.create).mockResolvedValue({} as any);

      const { saveGeneratedContent } = await import("../persist");
      await saveGeneratedContent("run-1", "profile-1", resultsWithoutHashtags as any);

      expect(prisma.generatedContent.create).toHaveBeenCalledWith({
        data: {
          runId: "run-1",
          profileId: "profile-1",
          platform: "X",
          textContent: "Post without tags",
          hashtags: [],
          mediaUrls: [],
          status: "DRAFT",
        },
      });
    });

    it("should throw if a single content creation fails", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error("Transaction aborted"));

      const { saveGeneratedContent } = await import("../persist");
      await expect(
        saveGeneratedContent("run-1", "profile-1", mockGenerationResults),
      ).rejects.toThrow("Transaction aborted");
    });
  });
});
