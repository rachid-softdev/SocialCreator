/**
 * Tests for trigger-client.ts — Agent run job queue helper (Infrastructure)
 *
 * Focuses on:
 * - enqueueAgentRun calls enqueueJob with correct payload and options
 * - isTriggerConfigured checks environment variables
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/job-queue", () => ({
  enqueueJob: vi.fn(),
}));

import { enqueueAgentRun, isTriggerConfigured } from "../trigger-client";

describe("trigger-client (agent run queue helper)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enqueueAgentRun", () => {
    it("calls enqueueJob with the agent-run type and correct payload", async () => {
      const payload = {
        agentId: "agent-1",
        runId: "run-1",
        userId: "user-1",
        profileId: "profile-1",
      };

      await enqueueAgentRun(payload);

      const { enqueueJob } = await import("@/lib/job-queue");
      expect(enqueueJob).toHaveBeenCalledOnce();
      expect(enqueueJob).toHaveBeenCalledWith(
        "agent-run",
        {
          agentId: "agent-1",
          runId: "run-1",
          userId: "user-1",
        },
        { maxAttempts: 2, retryDelayMs: 5000 },
      );
    });

    it("strips profileId from the job payload", async () => {
      // profileId should NOT appear in the enqueued payload
      const payload = { agentId: "a", runId: "r", userId: "u", profileId: "p" };

      await enqueueAgentRun(payload);

      const { enqueueJob } = await import("@/lib/job-queue");
      const callPayload = vi.mocked(enqueueJob).mock.calls[0]![1];
      expect(callPayload).not.toHaveProperty("profileId");
    });
  });

  describe("isTriggerConfigured", () => {
    beforeEach(() => {
      delete process.env.TRIGGER_API_URL;
      delete process.env.TRIGGER_API_KEY;
    });

    it("returns true when both TRIGGER_API_URL and TRIGGER_API_KEY are set", () => {
      process.env.TRIGGER_API_URL = "https://trigger.example.com";
      process.env.TRIGGER_API_KEY = "sk-test";
      expect(isTriggerConfigured()).toBe(true);
    });

    it("returns false when TRIGGER_API_URL is missing", () => {
      process.env.TRIGGER_API_KEY = "sk-test";
      expect(isTriggerConfigured()).toBe(false);
    });

    it("returns false when TRIGGER_API_KEY is missing", () => {
      process.env.TRIGGER_API_URL = "https://trigger.example.com";
      expect(isTriggerConfigured()).toBe(false);
    });

    it("returns false when both env vars are missing", () => {
      expect(isTriggerConfigured()).toBe(false);
    });

    it("returns false when env vars are empty strings", () => {
      process.env.TRIGGER_API_URL = "";
      process.env.TRIGGER_API_KEY = "";
      expect(isTriggerConfigured()).toBe(false);
    });
  });
});
