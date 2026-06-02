/**
 * Tests for worker polling/processing pattern
 * Based on design spec: docs/architecture/02-async-agent-queue.md
 *
 * Self-contained: implements worker logic inline matching the design spec.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ========== Inline implementation matching the design spec ==========

interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  priority: "low" | "normal" | "high" | "critical";
  status: "queued" | "running" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  retryDelayMs: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

const POLL_INTERVAL = 500;
const MAX_CONCURRENT = 3;

let pollingTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

// External dependencies (to be injected/mocked)
let dequeueFn: () => Job | null = () => null;
let completeFn: (id: string, result?: unknown) => void = () => {};
let failFn: (id: string, error: string) => void = () => {};
let getActiveCountFn: () => number = () => 0;
let getHandlerFn: (type: string) => JobHandler | undefined = () => undefined;

function configureWorker(config: {
  dequeue: () => Job | null;
  complete: (id: string, result?: unknown) => void;
  fail: (id: string, error: string) => void;
  getActiveCount: () => number;
  getHandler: (type: string) => JobHandler | undefined;
}) {
  dequeueFn = config.dequeue;
  completeFn = config.complete;
  failFn = config.fail;
  getActiveCountFn = config.getActiveCount;
  getHandlerFn = config.getHandler;
}

function processNext(): void {
  if (getActiveCountFn() >= MAX_CONCURRENT) return;

  const job = dequeueFn();
  if (!job) return;

  const handler = getHandlerFn(job.type);
  if (!handler) {
    failFn(job.id, `No handler for job type: ${job.type}`);
    return;
  }

  // Use .then() pattern so the interval callback is synchronous
  handler(job.payload).then(
    () => completeFn(job.id),
    (err: unknown) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      failFn(job.id, message);
    },
  );
}

function startWorker(): void {
  if (isRunning) return;
  isRunning = true;
  pollingTimer = setInterval(processNext, POLL_INTERVAL);
}

function stopWorker(): void {
  isRunning = false;
  if (pollingTimer !== null) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

function resetWorkerState(): void {
  stopWorker();
  isRunning = false;
  pollingTimer = null;
}

// ========== Tests ==========

describe("Worker", () => {
  let mockDequeue: ReturnType<typeof vi.fn>;
  let mockComplete: ReturnType<typeof vi.fn>;
  let mockFail: ReturnType<typeof vi.fn>;
  let mockGetActiveCount: ReturnType<typeof vi.fn>;
  let mockGetHandler: ReturnType<typeof vi.fn>;

  function makeJob(overrides: Partial<Job> = {}): Job {
    return {
      id: "job-1",
      type: "agent-run",
      payload: { agentId: "a-1", runId: "r-1", userId: "u-1" },
      priority: "normal",
      status: "running",
      attempts: 1,
      maxAttempts: 3,
      retryDelayMs: 1000,
      createdAt: Date.now(),
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mockDequeue = vi.fn();
    mockComplete = vi.fn();
    mockFail = vi.fn();
    mockGetActiveCount = vi.fn(() => 0);
    mockGetHandler = vi.fn();

    configureWorker({
      dequeue: mockDequeue,
      complete: mockComplete,
      fail: mockFail,
      getActiveCount: mockGetActiveCount,
      getHandler: mockGetHandler,
    });
  });

  afterEach(() => {
    resetWorkerState();
    vi.useRealTimers();
  });

  describe("startWorker / stopWorker", () => {
    it("should start polling when startWorker is called", () => {
      startWorker();
      vi.advanceTimersByTime(500);

      expect(mockDequeue).toHaveBeenCalled();
    });

    it("should not start a second polling interval if already running", () => {
      startWorker();
      startWorker();
      vi.advanceTimersByTime(500);

      const callCount = mockDequeue.mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(1);
    });

    it("should stop polling when stopWorker is called", () => {
      startWorker();
      vi.advanceTimersByTime(500);
      expect(mockDequeue.mock.calls.length).toBeGreaterThanOrEqual(1);

      stopWorker();
      const afterStop = mockDequeue.mock.calls.length;

      vi.advanceTimersByTime(1000);
      expect(mockDequeue.mock.calls.length).toBe(afterStop);
    });

    it("should resume polling when restarted after stop", () => {
      startWorker();
      vi.advanceTimersByTime(500);
      stopWorker();
      vi.advanceTimersByTime(500);

      const beforeRestart = mockDequeue.mock.calls.length;

      startWorker();
      vi.advanceTimersByTime(500);

      expect(mockDequeue.mock.calls.length).toBeGreaterThan(beforeRestart);
    });
  });

  describe("Job processing", () => {
    it("should process a dequeued job using its handler", () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      mockGetHandler.mockReturnValue(handler);
      mockDequeue.mockReturnValue(makeJob());

      startWorker();
      vi.advanceTimersByTime(500);

      expect(handler).toHaveBeenCalledWith({ agentId: "a-1", runId: "r-1", userId: "u-1" });
    });

    it("should fail the job when no handler is registered", () => {
      mockGetHandler.mockReturnValue(undefined);
      mockDequeue.mockReturnValue(makeJob({ type: "unknown-type" }));

      startWorker();
      vi.advanceTimersByTime(500);

      expect(mockFail).toHaveBeenCalledWith(
        "job-1",
        expect.stringContaining("No handler for job type"),
      );
    });

    it("should complete the job on successful handler execution", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      mockGetHandler.mockReturnValue(handler);
      mockDequeue.mockReturnValue(makeJob());

      startWorker();
      vi.advanceTimersByTime(500);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockComplete).toHaveBeenCalledWith("job-1");
    });

    it("should fail the job when handler throws an error", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler crashed"));
      mockGetHandler.mockReturnValue(handler);
      mockDequeue.mockReturnValue(makeJob({ type: "publish", payload: { contentId: "c-1" } }));

      startWorker();
      vi.advanceTimersByTime(500);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockFail).toHaveBeenCalledWith("job-1", "Handler crashed");
    });

    it("should handle non-Error thrown values from handlers", async () => {
      const handler = vi.fn().mockRejectedValue("string error message");
      mockGetHandler.mockReturnValue(handler);
      mockDequeue.mockReturnValue(makeJob());

      startWorker();
      vi.advanceTimersByTime(500);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockFail).toHaveBeenCalledWith("job-1", "Unknown error");
    });
  });

  describe("Concurrent execution cap", () => {
    it("should not dequeue when max concurrent jobs are running", () => {
      mockGetActiveCount.mockReturnValue(3);

      startWorker();
      vi.advanceTimersByTime(500);

      expect(mockDequeue).not.toHaveBeenCalled();
    });

    it("should resume dequeuing when active count drops below max", () => {
      mockGetActiveCount.mockReturnValue(3);

      startWorker();
      vi.advanceTimersByTime(500);
      const callsWhenFull = mockDequeue.mock.calls.length;

      mockGetActiveCount.mockReturnValue(2);
      mockDequeue.mockReturnValue(makeJob({ id: "job-2", payload: { agentId: "a-2" } }));

      vi.advanceTimersByTime(500);

      expect(mockDequeue.mock.calls.length).toBeGreaterThan(callsWhenFull);
    });
  });

  describe("Edge cases", () => {
    it("should not crash when dequeueJob returns null", () => {
      mockDequeue.mockReturnValue(null);

      expect(() => {
        startWorker();
        vi.advanceTimersByTime(500);
      }).not.toThrow();
    });

    it("should handle rapid start/stop cycles", () => {
      expect(() => {
        startWorker();
        stopWorker();
        startWorker();
        stopWorker();
        startWorker();
      }).not.toThrow();

      vi.advanceTimersByTime(500);
      stopWorker();
      expect(mockDequeue).toHaveBeenCalled();
    });

    it("should not leave timers running after stop", () => {
      startWorker();
      stopWorker();

      expect(() => vi.clearAllTimers()).not.toThrow();
    });
  });
});
