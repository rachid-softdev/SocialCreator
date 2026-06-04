/**
 * Tests for trigger.ts barrel re-export (Infrastructure)
 *
 * trigger.ts simply re-exports enqueueJob and getQueueSize from @/lib/job-queue.
 * This test verifies the re-exports resolve to real functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/job-queue", () => ({
  enqueueJob: vi.fn(),
  getQueueSize: vi.fn(),
}));

import { enqueueJob, getQueueSize } from "../trigger";

describe("trigger barrel re-export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-exports enqueueJob as a function", () => {
    expect(typeof enqueueJob).toBe("function");
    enqueueJob("test-job" as any, {} as any);
    expect(enqueueJob).toHaveBeenCalledWith("test-job" as any, {} as any);
  });

  it("re-exports getQueueSize as a function", () => {
    expect(typeof getQueueSize).toBe("function");
    getQueueSize();
    expect(getQueueSize).toHaveBeenCalledOnce();
  });
});
