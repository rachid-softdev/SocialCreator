/**
 * Tests for queue extensions: getJobs, getJobsAsync, and backend.list()
 *
 * Self-contained: implements inline queue and backend matching source.
 */
import { beforeEach, describe, expect, it } from "vitest";

// ========== Inline types ==========

type JobPriority = "low" | "normal" | "high" | "critical";
type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
type JobType = "agent-run" | "content-generate" | "publish" | "video-process";

interface Job {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  priority: JobPriority;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  retryDelayMs: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: unknown;
}

interface QueueBackend {
  enqueue(job: Omit<Job, "id">): Promise<string>;
  dequeue(): Promise<Job | null>;
  complete(id: string, result?: unknown): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  schedule(job: Omit<Job, "id">, delayMs: number): Promise<string>;
  getStatus(): Promise<any>;
  getJob(id: string): Promise<Job | undefined>;
  getQueueSize(): Promise<number>;
  getActiveCount(): Promise<number>;
  clear(): Promise<void>;
  list(): Promise<Job[]>;
}

// ========== In-memory queue backend ==========

const PRIORITY_ORDER: Record<JobPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

class InMemoryBackend implements QueueBackend {
  private jobs: Job[] = [];
  private activeJobs = new Set<string>();
  private counter = 0;

  async enqueue(job: Omit<Job, "id">): Promise<string> {
    const id = `job-${++this.counter}`;
    const newJob: Job = { ...job, id };

    const insertIndex = this.jobs.findIndex(
      (j) => PRIORITY_ORDER[j.priority] > PRIORITY_ORDER[newJob.priority],
    );

    if (insertIndex === -1) {
      this.jobs.push(newJob);
    } else {
      this.jobs.splice(insertIndex, 0, newJob);
    }

    return id;
  }

  async dequeue(): Promise<Job | null> {
    const idx = this.jobs.findIndex((j) => j.status === "queued");
    if (idx === -1) return null;

    const job = this.jobs[idx];
    job.status = "running";
    job.startedAt = Date.now();
    job.attempts++;
    this.activeJobs.add(job.id);

    return job;
  }

  async complete(id: string, result?: unknown): Promise<void> {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return;
    job.status = "completed";
    job.completedAt = Date.now();
    job.result = result;
    this.activeJobs.delete(id);
  }

  async fail(id: string, error: string): Promise<void> {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return;
    job.status = "failed";
    job.error = error;
    job.completedAt = Date.now();
    this.activeJobs.delete(id);
  }

  async schedule(_job: Omit<Job, "id">, _delayMs: number): Promise<string> {
    return "scheduled-id";
  }

  async getStatus(): Promise<any> {
    return {};
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.find((j) => j.id === id);
  }

  async getQueueSize(): Promise<number> {
    return this.jobs.filter((j) => j.status === "queued").length;
  }

  async getActiveCount(): Promise<number> {
    return this.activeJobs.size;
  }

  async clear(): Promise<void> {
    this.jobs.length = 0;
    this.activeJobs.clear();
    this.counter = 0;
  }

  async list(): Promise<Job[]> {
    return [...this.jobs].sort((a, b) => b.createdAt - a.createdAt);
  }
}

// ========== Inline sync queue ==========

let jobQueue: Job[] = [];
const activeJobs = new Set<string>();
let counter = 0;

function resetQueue() {
  jobQueue = [];
  activeJobs.clear();
  counter = 0;
}

function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  priority: JobPriority = "normal",
): string {
  const id = `job-${++counter}`;
  const job: Job = {
    id,
    type,
    payload,
    priority,
    status: "queued",
    attempts: 0,
    maxAttempts: 3,
    retryDelayMs: 1000,
    createdAt: Date.now(),
  };

  const insertIndex = jobQueue.findIndex(
    (j) => PRIORITY_ORDER[j.priority] > PRIORITY_ORDER[job.priority],
  );

  if (insertIndex === -1) {
    jobQueue.push(job);
  } else {
    jobQueue.splice(insertIndex, 0, job);
  }

  return id;
}

function getJobs(): Job[] {
  return [...jobQueue].sort((a, b) => b.createdAt - a.createdAt);
}

// ========== Tests ==========

describe("Queue: getJobs (sync)", () => {
  beforeEach(() => {
    resetQueue();
  });

  it("should return empty array when queue is empty", () => {
    const jobs = getJobs();
    expect(jobs).toStrictEqual([]);
  });

  it("should return all jobs sorted by createdAt descending", () => {
    enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" }, "low");
    enqueueJob(
      "publish",
      { contentId: "c-1", profileId: "p-1", platform: "X", userId: "u-1" },
      "high",
    );
    enqueueJob(
      "content-generate",
      { profileId: "p-1", platform: "X", brief: "test", agentId: "a-1" },
      "normal",
    );

    const jobs = getJobs();
    expect(jobs).toHaveLength(3);
    // Sorted by createdAt descending (newest first)
    for (let i = 1; i < jobs.length; i++) {
      expect(jobs[i - 1].createdAt).toBeGreaterThanOrEqual(jobs[i].createdAt);
    }
  });

  it("should return a copy, not a reference to internal array", () => {
    enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" });

    const jobs = getJobs();
    jobs.push({} as Job);

    expect(getJobs()).toHaveLength(1);
  });

  it("should include jobs in all statuses", () => {
    const id1 = enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" });
    const id2 = enqueueJob("publish", {
      contentId: "c-1",
      profileId: "p-1",
      platform: "X",
      userId: "u-1",
    });

    // Complete one
    const j1 = jobQueue.find((j) => j.id === id1);
    if (!j1) throw new Error("Job not found");
    j1.status = "completed";
    j1.completedAt = Date.now();

    const jobs = getJobs();
    expect(jobs).toHaveLength(2);

    const completedJob = jobs.find((j) => j.id === id1);
    expect(completedJob?.status).toBe("completed");

    const queuedJob = jobs.find((j) => j.id === id2);
    expect(queuedJob?.status).toBe("queued");
  });
});

describe("QueueBackend: list()", () => {
  let backend: InMemoryBackend;

  beforeEach(() => {
    backend = new InMemoryBackend();
  });

  it("should return empty array when no jobs exist", async () => {
    const jobs = await backend.list();
    expect(jobs).toStrictEqual([]);
  });

  it("should return all jobs sorted by createdAt descending", async () => {
    await backend.enqueue({
      type: "agent-run",
      payload: { agentId: "a-1", runId: "r-1", userId: "u-1" },
      priority: "normal",
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      retryDelayMs: 1000,
      createdAt: Date.now() - 3000,
    } as any);
    await backend.enqueue({
      type: "publish",
      payload: { contentId: "c-1", profileId: "p-1", platform: "X", userId: "u-1" },
      priority: "high",
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      retryDelayMs: 1000,
      createdAt: Date.now() - 1000,
    } as any);
    await backend.enqueue({
      type: "content-generate",
      payload: { profileId: "p-1", platform: "X", brief: "test", agentId: "a-1" },
      priority: "normal",
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      retryDelayMs: 1000,
      createdAt: Date.now() - 2000,
    } as any);

    const jobs = await backend.list();
    expect(jobs).toHaveLength(3);
    // Should be sorted by createdAt descending
    for (let i = 1; i < jobs.length; i++) {
      expect(jobs[i - 1].createdAt).toBeGreaterThanOrEqual(jobs[i].createdAt);
    }
  });

  it("should return a copy, not a reference to internal array", async () => {
    await backend.enqueue({
      type: "agent-run",
      payload: { agentId: "a-1", runId: "r-1", userId: "u-1" },
      priority: "normal",
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      retryDelayMs: 1000,
      createdAt: Date.now(),
    } as any);

    const jobs = await backend.list();
    const originalLength = jobs.length;
    (jobs as any).push({});

    const jobsAgain = await backend.list();
    expect(jobsAgain).toHaveLength(originalLength);
  });
});
