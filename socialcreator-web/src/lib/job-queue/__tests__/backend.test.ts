/**
 * Tests for job queue backends:
 * - InMemoryQueueBackend: enqueue, dequeue, complete, fail, schedule, clear, list
 * - RedisQueueBackend: all methods throw "not initialized"
 * - createQueueBackend(): factory with singleton, env-var-driven selection
 * - resetBackend(): clears the singleton
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── InMemoryQueueBackend tests ────────────────────────────────

describe("InMemoryQueueBackend", () => {
  let backend: import("../backend/in-memory").InMemoryQueueBackend;

  const baseJob = {
    type: "publish" as const,
    payload: { contentId: "c1", profileId: "p1", platform: "x" as const, userId: "u1" },
    priority: "normal" as const,
    status: "queued" as const,
    attempts: 0,
    maxAttempts: 3,
    retryDelayMs: 1000,
    createdAt: Date.now(),
  };

  beforeEach(async () => {
    const mod = await import("../backend/in-memory");
    backend = new mod.InMemoryQueueBackend();
  });

  describe("enqueue", () => {
    it("returns a string ID", async () => {
      const id = await backend.enqueue(baseJob);
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("inserts jobs in priority order (critical first)", async () => {
      const lowId = await backend.enqueue({
        ...baseJob,
        priority: "low",
        createdAt: Date.now() + 10,
      });
      const highId = await backend.enqueue({ ...baseJob, priority: "high", createdAt: Date.now() });
      const critId = await backend.enqueue({
        ...baseJob,
        priority: "critical",
        createdAt: Date.now() + 20,
      });

      const jobs = await backend.list();
      // sorted by createdAt desc by default — we need to check raw queue order via dequeue
      const first = await backend.dequeue();
      expect(first!.id).toBe(critId);
      const second = await backend.dequeue();
      expect(second!.id).toBe(highId);
      const third = await backend.dequeue();
      expect(third!.id).toBe(lowId);
    });

    it("throws when queue exceeds MAX_QUEUE_SIZE", async () => {
      // Fill the queue by spamming enqueue up to the limit
      // MAX_QUEUE_SIZE = 10_000, so we push 10_000 items
      for (let i = 0; i < 10_000; i++) {
        await backend.enqueue({ ...baseJob, createdAt: Date.now() + i });
      }
      await expect(backend.enqueue(baseJob)).rejects.toThrow("Queue is full");
    });
  });

  describe("dequeue", () => {
    it("returns the highest-priority queued job", async () => {
      await backend.enqueue({ ...baseJob, priority: "low" });
      const id = await backend.enqueue({ ...baseJob, priority: "high" });

      const job = await backend.dequeue();
      expect(job).not.toBeNull();
      expect(job!.id).toBe(id);
      expect(job!.status).toBe("running");
      expect(job!.attempts).toBe(1); // incremented on dequeue
      expect(job!.startedAt).toBeGreaterThan(0);
    });

    it("returns null when no queued jobs", async () => {
      const job = await backend.dequeue();
      expect(job).toBeNull();
    });

    it("does not return completed or failed jobs", async () => {
      const id = await backend.enqueue(baseJob);
      await backend.dequeue(); // move to running
      await backend.complete(id);

      const job = await backend.dequeue();
      expect(job).toBeNull();
    });
  });

  describe("complete", () => {
    it("marks a job as completed with optional result", async () => {
      const id = await backend.enqueue(baseJob);
      await backend.dequeue();

      await backend.complete(id, { success: true });

      const job = await backend.getJob(id);
      expect(job!.status).toBe("completed");
      expect(job!.completedAt).toBeGreaterThan(0);
      expect(job!.result).toStrictEqual({ success: true });
    });

    it("does nothing for unknown id", async () => {
      await expect(backend.complete("nonexistent")).resolves.toBeUndefined();
    });

    it("removes the job from active set", async () => {
      const id = await backend.enqueue(baseJob);
      await backend.dequeue();
      expect(await backend.getActiveCount()).toBe(1);

      await backend.complete(id);
      expect(await backend.getActiveCount()).toBe(0);
    });
  });

  describe("fail", () => {
    it("re-queues the job when attempts < maxAttempts (retry)", async () => {
      const id = await backend.enqueue({ ...baseJob, maxAttempts: 3, attempts: 0 });
      await backend.dequeue(); // attempts → 1

      await backend.fail(id, "Temporary error");

      const job = await backend.getJob(id);
      expect(job!.status).toBe("queued");
      expect(job!.error).toBe("Temporary error");
      // Should be dequeuable again
      const redequeued = await backend.dequeue();
      expect(redequeued!.id).toBe(id);
    });

    it("permanently fails the job when attempts >= maxAttempts", async () => {
      const id = await backend.enqueue({ ...baseJob, maxAttempts: 3, attempts: 3 });
      await backend.dequeue(); // attempts → 4

      await backend.fail(id, "Permanent error");

      const job = await backend.getJob(id);
      expect(job!.status).toBe("failed");
      expect(job!.error).toBe("Permanent error");
      expect(job!.completedAt).toBeGreaterThan(0);
      // Should NOT be dequeuable
      expect(await backend.dequeue()).toBeNull();
    });

    it("does nothing for unknown id", async () => {
      await expect(backend.fail("nonexistent", "error")).resolves.toBeUndefined();
    });

    it("removes job from active set on permanent failure", async () => {
      const id = await backend.enqueue({ ...baseJob, maxAttempts: 1, attempts: 0 });
      await backend.dequeue();
      expect(await backend.getActiveCount()).toBe(1);

      await backend.fail(id, "fail");
      expect(await backend.getActiveCount()).toBe(0);
    });
  });

  describe("schedule (setTimeout)", () => {
    it("returns an id immediately and enqueues after delay", async () => {
      vi.useFakeTimers();

      const id = await backend.schedule(baseJob, 1000);
      expect(typeof id).toBe("string");
      // Not yet in queue
      expect(await backend.getQueueSize()).toBe(0);

      // Advance time past the delay
      vi.advanceTimersByTime(1000);

      // Now the job should be enqueued
      expect(await backend.getQueueSize()).toBe(1);
      const job = await backend.dequeue();
      expect(job).not.toBeNull();
      expect(job!.type).toBe("publish");
      expect(job!.priority).toBe("normal");

      vi.useRealTimers();
    });

    it("handles multiple scheduled jobs with different delays", async () => {
      vi.useFakeTimers();

      await backend.schedule(baseJob, 2000);
      await backend.schedule(baseJob, 500);
      await backend.schedule(baseJob, 1000);

      expect(await backend.getQueueSize()).toBe(0);

      vi.advanceTimersByTime(500);
      expect(await backend.getQueueSize()).toBe(1);

      vi.advanceTimersByTime(500);
      expect(await backend.getQueueSize()).toBe(2);

      vi.advanceTimersByTime(1000);
      expect(await backend.getQueueSize()).toBe(3);

      vi.useRealTimers();
    });
  });

  describe("clear", () => {
    it("removes all jobs and resets active set", async () => {
      await backend.enqueue(baseJob);
      await backend.enqueue(baseJob);
      await backend.enqueue(baseJob);
      expect(await backend.getQueueSize()).toBe(3);

      await backend.clear();
      expect(await backend.getQueueSize()).toBe(0);
      expect(await backend.getActiveCount()).toBe(0);
      expect(await backend.list()).toStrictEqual([]);
    });
  });

  describe("list (sorted by createdAt desc)", () => {
    it("returns jobs sorted by createdAt descending", async () => {
      const id1 = await backend.enqueue({ ...baseJob, createdAt: 100 });
      const id2 = await backend.enqueue({ ...baseJob, createdAt: 200 });
      const id3 = await backend.enqueue({ ...baseJob, createdAt: 150 });

      const jobs = await backend.list();
      expect(jobs.map((j) => j.id)).toStrictEqual([id2, id3, id1]);
    });

    it("returns an empty array when no jobs exist", async () => {
      expect(await backend.list()).toStrictEqual([]);
    });
  });

  describe("getStatus", () => {
    it("returns correct counts", async () => {
      const id = await backend.enqueue(baseJob);
      await backend.dequeue();
      await backend.enqueue(baseJob);
      await backend.complete(id);

      const status = await backend.getStatus();
      expect(status.queued).toBe(1);
      expect(status.running).toBe(0); // complete removed from active
      expect(status.completed).toBe(1);
      expect(status.failed).toBe(0);
      expect(status.total).toBe(2);
    });
  });

  describe("getJob", () => {
    it("returns a job by id", async () => {
      const id = await backend.enqueue(baseJob);
      const job = await backend.getJob(id);
      expect(job).toBeDefined();
      expect(job!.id).toBe(id);
    });

    it("returns undefined for unknown id", async () => {
      const job = await backend.getJob("nonexistent");
      expect(job).toBeUndefined();
    });
  });

  describe("getQueueSize / getActiveCount", () => {
    it("returns the number of queued and active jobs", async () => {
      expect(await backend.getQueueSize()).toBe(0);
      expect(await backend.getActiveCount()).toBe(0);

      await backend.enqueue(baseJob);
      expect(await backend.getQueueSize()).toBe(1);

      await backend.dequeue();
      expect(await backend.getQueueSize()).toBe(0);
      expect(await backend.getActiveCount()).toBe(1);
    });
  });
});

// ── RedisQueueBackend tests ───────────────────────────────────

describe("RedisQueueBackend", () => {
  it("enqueue throws 'requires bullmq'", async () => {
    const mod = await import("../backend/redis");
    const backend = new mod.RedisQueueBackend();
    await expect(backend.enqueue({} as any)).rejects.toThrow(/requires bullmq/i);
  });

  it("dequeue throws 'not initialized'", async () => {
    const mod = await import("../backend/redis");
    const backend = new mod.RedisQueueBackend();
    await expect(backend.dequeue()).rejects.toThrow(/not initialized/i);
  });

  it("complete throws 'not initialized'", async () => {
    const mod = await import("../backend/redis");
    const backend = new mod.RedisQueueBackend();
    await expect(backend.complete("id")).rejects.toThrow(/not initialized/i);
  });

  it("fail throws 'not initialized'", async () => {
    const mod = await import("../backend/redis");
    const backend = new mod.RedisQueueBackend();
    await expect(backend.fail("id", "err")).rejects.toThrow(/not initialized/i);
  });

  it("schedule throws 'not initialized'", async () => {
    const mod = await import("../backend/redis");
    const backend = new mod.RedisQueueBackend();
    await expect(backend.schedule({} as any, 0)).rejects.toThrow(/not initialized/i);
  });

  it("getStatus throws 'not initialized'", async () => {
    const mod = await import("../backend/redis");
    const backend = new mod.RedisQueueBackend();
    await expect(backend.getStatus()).rejects.toThrow(/not initialized/i);
  });

  it("getJob throws 'not initialized'", async () => {
    const mod = await import("../backend/redis");
    const backend = new mod.RedisQueueBackend();
    await expect(backend.getJob("id")).rejects.toThrow(/not initialized/i);
  });

  it("getQueueSize throws 'not initialized'", async () => {
    const mod = await import("../backend/redis");
    const backend = new mod.RedisQueueBackend();
    await expect(backend.getQueueSize()).rejects.toThrow(/not initialized/i);
  });

  it("getActiveCount throws 'not initialized'", async () => {
    const mod = await import("../backend/redis");
    const backend = new mod.RedisQueueBackend();
    await expect(backend.getActiveCount()).rejects.toThrow(/not initialized/i);
  });

  it("clear throws 'not initialized'", async () => {
    const mod = await import("../backend/redis");
    const backend = new mod.RedisQueueBackend();
    await expect(backend.clear()).rejects.toThrow(/not initialized/i);
  });

  it("list throws 'not implemented'", async () => {
    const mod = await import("../backend/redis");
    const backend = new mod.RedisQueueBackend();
    await expect(backend.list()).rejects.toThrow(/not implemented/i);
  });
});

// ── createQueueBackend / resetBackend ─────────────────────────

describe("createQueueBackend()", () => {
  beforeEach(async () => {
    // Reset the singleton before each test
    const mod = await import("../backend/index");
    mod.resetBackend();
    delete process.env.REDIS_HOST;
  });

  it("returns InMemoryQueueBackend when REDIS_HOST is absent", async () => {
    const mod = await import("../backend/index");
    const backend = mod.createQueueBackend();
    const inMemMod = await import("../backend/in-memory");
    expect(backend).toBeInstanceOf(inMemMod.InMemoryQueueBackend);
  });

  it("falls back to InMemoryQueueBackend when Redis module fails to instantiate", async () => {
    // Mock the redis module so its constructor throws
    vi.doMock("../backend/redis", () => ({
      RedisQueueBackend: class {
        constructor() {
          throw new Error("bullmq not installed");
        }
      },
    }));

    process.env.REDIS_HOST = "localhost";

    // Re-import the module fresh with the mock applied
    const mod = await import("../backend/index");
    const backend = mod.createQueueBackend();
    const inMemMod = await import("../backend/in-memory");
    expect(backend).toBeInstanceOf(inMemMod.InMemoryQueueBackend);

    // Clean up the mock
    vi.unmock("../backend/redis");
  });

  it("returns the same singleton instance on multiple calls", async () => {
    const mod = await import("../backend/index");
    const first = mod.createQueueBackend();
    const second = mod.createQueueBackend();
    expect(second).toBe(first);
  });
});

describe("resetBackend()", () => {
  it("clears the singleton so the next createQueueBackend returns a new instance", async () => {
    const mod = await import("../backend/index");
    const first = mod.createQueueBackend();
    mod.resetBackend();
    const second = mod.createQueueBackend();
    expect(second).not.toBe(first);
  });
});
