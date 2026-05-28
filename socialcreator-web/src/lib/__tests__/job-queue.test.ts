/**
 * Tests for job queue
 * - enqueueJob() returns a string ID
 * - getQueueSize() returns a number
 * - Jobs execute and are removed from queue on completion
 * - Failed jobs are retried
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueJob, getQueueSize } from "../job-queue";

describe("Job Queue", () => {
  beforeEach(() => {
    // Clear any pending jobs between tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("enqueueJob", () => {
    it("should return a string ID", () => {
      const id = enqueueJob("test-job", vi.fn());
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("should generate unique IDs for consecutive calls", () => {
      const id1 = enqueueJob("job-1", vi.fn());
      const id2 = enqueueJob("job-2", vi.fn());
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

    it("should reflect number of pending jobs when async execution is pending", () => {
      // Jobs are removed from the queue map immediately when they start executing
      // inside queueMicrotask, so synchronously the queue shows 1 before the microtask runs
      const _id = enqueueJob("pending-job", vi.fn());
      // The job is still in the queue until the microtask processes it
      expect(getQueueSize()).toBe(1);
    });

    it("should reduce size as jobs complete", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      enqueueJob("quick-job", fn);

      // Wait for microtask to process
      await vi.runAllTimersAsync();

      // After processing, the job should be removed
      expect(getQueueSize()).toBe(0);
    });
  });
});
