/**
 * Redis Queue Backend (BullMQ)
 * Production queue with persistence, retries, and delayed jobs.
 *
 * Prerequisites:
 * - Install bullmq: pnpm add bullmq
 * - Configure REDIS_HOST, REDIS_PORT, REDIS_PASSWORD env vars
 */

import type { Job } from "../types";
import type { QueueBackend, QueueStatus } from "./types";

/**
 * RedisQueueBackend wraps BullMQ for persistent job processing.
 *
 * NOTE: This is a placeholder implementation. To activate:
 * 1. Install bullmq: pnpm add bullmq ioredis
 * 2. Set REDIS_HOST, REDIS_PORT, REDIS_PASSWORD environment variables
 * 3. The factory in index.ts will automatically use this backend
 *
 * For now without BullMQ installed, this class throws descriptive errors
 * so callers can fall back to InMemoryQueueBackend gracefully.
 */

export class RedisQueueBackend implements QueueBackend {
  constructor() {
    // When bullmq is installed, initialize:
    // this.queue = new BullQueue("socialcreator", { connection: { ... } });
  }

  async enqueue(_job: Omit<Job, "id">): Promise<string> {
    throw new Error(
      "RedisQueueBackend requires bullmq. Install it with: pnpm add bullmq ioredis",
    );
  }

  async dequeue(): Promise<Job | null> {
    throw new Error("RedisQueueBackend not initialized");
  }

  async complete(_id: string, _result?: unknown): Promise<void> {
    throw new Error("RedisQueueBackend not initialized");
  }

  async fail(_id: string, _error: string): Promise<void> {
    throw new Error("RedisQueueBackend not initialized");
  }

  async schedule(_job: Omit<Job, "id">, _delayMs: number): Promise<string> {
    throw new Error("RedisQueueBackend not initialized");
  }

  async getStatus(): Promise<QueueStatus> {
    throw new Error("RedisQueueBackend not initialized");
  }

  async getJob(_id: string): Promise<Job | undefined> {
    throw new Error("RedisQueueBackend not initialized");
  }

  async getQueueSize(): Promise<number> {
    throw new Error("RedisQueueBackend not initialized");
  }

  async getActiveCount(): Promise<number> {
    throw new Error("RedisQueueBackend not initialized");
  }

  async clear(): Promise<void> {
    throw new Error("RedisQueueBackend not initialized");
  }

  async list(): Promise<Job[]> {
    throw new Error("RedisQueueBackend not implemented");
  }
}
