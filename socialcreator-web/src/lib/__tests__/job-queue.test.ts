/**
 * Tests for job queue
 * - enqueueJob() returns a string ID
 * - getQueueSize() returns a number
 * - Jobs are tracked in the queue until processed
 * - Queued count reflects pending jobs
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearQueue, dequeueJob, enqueueJob, getQueueSize } from "../job-queue";

describe("Job Queue", () => {
  beforeEach(() => {
    clearQueue();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("enqueueJob", () => {
    it("should return a string ID", () => {
      const id = enqueueJob("content-generate", {
        profileId: "p1",
        platform: "X",
        brief: "test",
        agentId: "a1",
      });
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("should generate unique IDs for consecutive calls", () => {
      const id1 = enqueueJob("content-generate", {
        profileId: "p1",
        platform: "X",
        brief: "test",
        agentId: "a1",
      });
      const id2 = enqueueJob("content-generate", {
        profileId: "p2",
        platform: "INSTAGRAM",
        brief: "test2",
        agentId: "a2",
      });
      expect(id1).not.toBe(id2);
    });
  });

  describe("getQueueSize", () => {
    it("should return a number", () => {
      expect(typeof getQueueSize()).toBe("number");
    });

    it("should return 0 when no jobs are queued", () => {
      expect(getQueueSize()).toBe(0);
    });

    it("should reflect number of queued jobs after enqueue", () => {
      enqueueJob("content-generate", {
        profileId: "p1",
        platform: "X",
        brief: "test",
        agentId: "a1",
      });
      expect(getQueueSize()).toBe(1);
    });

    it("should reduce to 0 when queued jobs are dequeued", () => {
      enqueueJob("content-generate", {
        profileId: "p1",
        platform: "X",
        brief: "test",
        agentId: "a1",
      });
      expect(getQueueSize()).toBe(1);

      const job = dequeueJob();
      expect(job).not.toBeNull();
      expect(getQueueSize()).toBe(0);
    });
  });
});
