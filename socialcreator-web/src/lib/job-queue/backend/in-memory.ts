/**
 * In-Memory Queue Backend
 * Mirrors the logic from queue.ts as a QueueBackend implementation
 * Used as the default backend when Redis is not configured
 */

import { randomUUID } from "node:crypto";
import logger from "@/lib/logger";
import type { Job, JobPriority } from "../types";
import type { QueueBackend, QueueStatus } from "./types";

const PRIORITY_ORDER: Record<JobPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const MAX_QUEUE_SIZE = 10_000;
const MAX_ARCHIVE_SIZE = 5_000;

export class InMemoryQueueBackend implements QueueBackend {
  private jobs: Job[] = [];
  private activeJobs = new Set<string>();

  async enqueue(job: Omit<Job, "id">): Promise<string> {
    if (this.jobs.length >= MAX_QUEUE_SIZE) {
      throw new Error(`Queue is full (max ${MAX_QUEUE_SIZE} jobs)`);
    }

    const id = randomUUID();
    const newJob: Job = { ...job, id };

    // Insert in priority order (critical first)
    const insertIndex = this.jobs.findIndex(
      (j) => PRIORITY_ORDER[j.priority] > PRIORITY_ORDER[newJob.priority],
    );

    if (insertIndex === -1) {
      this.jobs.push(newJob);
    } else {
      this.jobs.splice(insertIndex, 0, newJob);
    }

    logger.debug({ jobId: id, type: newJob.type, priority: newJob.priority }, "Job enqueued");
    return id;
  }

  async dequeue(): Promise<Job | null> {
    const idx = this.jobs.findIndex((j) => j.status === "queued");
    if (idx === -1) return null;

    const job = this.jobs[idx]!;
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

    logger.debug({ jobId: id, type: job.type }, "Job completed");
    this.trimArchive();
  }

  async fail(id: string, error: string): Promise<void> {
    const jobIndex = this.jobs.findIndex((j) => j.id === id);
    if (jobIndex === -1) return;
    const job = this.jobs[jobIndex]!;

    if (job.attempts < job.maxAttempts) {
      this.jobs.splice(jobIndex, 1);
      job.status = "queued";
      job.error = error;
      this.activeJobs.delete(id);

      const insertIndex = this.jobs.findIndex(
        (j) => PRIORITY_ORDER[j.priority] > PRIORITY_ORDER[job.priority],
      );
      if (insertIndex === -1) {
        this.jobs.push(job);
      } else {
        this.jobs.splice(insertIndex, 0, job);
      }

      logger.warn(
        { jobId: id, type: job.type, attempt: job.attempts, maxAttempts: job.maxAttempts },
        "Job failed, will retry",
      );
    } else {
      job.status = "failed";
      job.error = error;
      job.completedAt = Date.now();
      this.activeJobs.delete(id);

      logger.error(
        { jobId: id, type: job.type, attempts: job.maxAttempts, error },
        "Job failed after all retries",
      );
    }

    this.trimArchive();
  }

  async schedule(job: Omit<Job, "id">, delayMs: number): Promise<string> {
    // In-memory: schedule via setTimeout, then enqueue
    const id = randomUUID();
    setTimeout(() => {
      this.enqueue({ ...job, id } as Job).catch((err) =>
        logger.error({ err, jobId: id }, "Failed to enqueue delayed job"),
      );
    }, delayMs);
    logger.debug({ jobId: id, type: job.type, delayMs }, "Job scheduled");
    return id;
  }

  async getStatus(): Promise<QueueStatus> {
    return {
      queued: this.jobs.filter((j) => j.status === "queued").length,
      running: this.activeJobs.size,
      completed: this.jobs.filter((j) => j.status === "completed").length,
      failed: this.jobs.filter((j) => j.status === "failed").length,
      total: this.jobs.length,
    };
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
  }

  async list(): Promise<Job[]> {
    return [...this.jobs].sort((a, b) => b.createdAt - a.createdAt);
  }

  private trimArchive(): void {
    const completedCount = this.jobs.filter(
      (j) => j.status === "completed" || j.status === "failed",
    ).length;
    if (completedCount > MAX_ARCHIVE_SIZE) {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      this.jobs = this.jobs.filter(
        (j) =>
          j.status === "queued" ||
          j.status === "running" ||
          (j.completedAt && j.completedAt > cutoff),
      );
    }
  }
}
