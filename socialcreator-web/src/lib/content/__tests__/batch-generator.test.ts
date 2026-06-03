/**
 * Tests for Batch Content Generator
 *
 * Verifies:
 * - Single platform
 * - Multiple platforms
 * - Each job has correct payload
 * - enqueueJob is called correctly
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ───────────────────────────────────────────────

const mockEnqueueJob = vi.hoisted(() => vi.fn());

vi.mock("@/lib/job-queue", () => ({
  enqueueJob: mockEnqueueJob,
}));

// ── Imports (after mocks) ──────────────────────────────────────

import { enqueueBatchJobs } from "../batch-generator";

describe("Batch Generator — enqueueBatchJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnqueueJob.mockReturnValue("job-id");
  });

  describe("single platform", () => {
    it("should enqueue a single job for one platform", async () => {
      const result = await enqueueBatchJobs({
        userId: "user-1",
        profileId: "profile-1",
        brief: "Test brief",
        platforms: ["X"],
      });

      expect(result.total).toBe(1);
      expect(result.jobIds).toHaveLength(1);
      expect(mockEnqueueJob).toHaveBeenCalledTimes(1);
    });

    it("should set correct payload for single platform", async () => {
      await enqueueBatchJobs({
        userId: "user-1",
        profileId: "profile-1",
        brief: "Test brief",
        platforms: ["X"],
        keywords: ["ai", "tech"],
        brandVoice: "Professional",
        count: 2,
      });

      expect(mockEnqueueJob).toHaveBeenCalledWith("content-generate", {
        userId: "user-1",
        profileId: "profile-1",
        platform: "X",
        brief: "Test brief",
        keywords: ["ai", "tech"],
        brandVoice: "Professional",
        count: 2,
        agentId: "",
      });
    });
  });

  describe("multiple platforms", () => {
    it("should enqueue one job per platform", async () => {
      const result = await enqueueBatchJobs({
        userId: "user-1",
        profileId: "profile-1",
        brief: "Test brief",
        platforms: ["X", "LINKEDIN", "INSTAGRAM"],
      });

      expect(result.total).toBe(3);
      expect(result.jobIds).toHaveLength(3);
      expect(mockEnqueueJob).toHaveBeenCalledTimes(3);
    });

    it("should use correct platform for each job", async () => {
      await enqueueBatchJobs({
        userId: "user-1",
        profileId: "profile-1",
        brief: "Test brief",
        platforms: ["X", "LINKEDIN"],
      });

      expect(mockEnqueueJob).toHaveBeenNthCalledWith(
        1,
        "content-generate",
        expect.objectContaining({ platform: "X" }),
      );
      expect(mockEnqueueJob).toHaveBeenNthCalledWith(
        2,
        "content-generate",
        expect.objectContaining({ platform: "LINKEDIN" }),
      );
    });

    it("should share the same batchId across all jobs in a batch", async () => {
      const result = await enqueueBatchJobs({
        userId: "user-1",
        profileId: "profile-1",
        brief: "Test brief",
        platforms: ["X", "LINKEDIN"],
      });

      expect(result.batchId).toBeTruthy();
      expect(typeof result.batchId).toBe("string");
      // UUID format check
      expect(result.batchId).toMatch(/^[0-9a-f-]+$/);
    });
  });

  describe("payload defaults", () => {
    it("should default count to 1 when not specified", async () => {
      await enqueueBatchJobs({
        userId: "user-1",
        profileId: "profile-1",
        brief: "Test brief",
        platforms: ["X"],
      });

      expect(mockEnqueueJob).toHaveBeenCalledWith(
        "content-generate",
        expect.objectContaining({ count: 1 }),
      );
    });

    it("should default agentId to empty string", async () => {
      await enqueueBatchJobs({
        userId: "user-1",
        profileId: "profile-1",
        brief: "Test brief",
        platforms: ["X"],
      });

      expect(mockEnqueueJob).toHaveBeenCalledWith(
        "content-generate",
        expect.objectContaining({ agentId: "" }),
      );
    });
  });
});
