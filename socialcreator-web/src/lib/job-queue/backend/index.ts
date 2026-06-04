/**
 * Queue Backend Factory
 * Creates the appropriate backend based on configuration
 */

import { InMemoryQueueBackend } from "./in-memory";
import type { QueueBackend } from "./types";

let backendInstance: QueueBackend | null = null;

/**
 * Create or return the existing queue backend.
 * Defaults to in-memory. Configure REDIS_HOST for Redis/BullMQ backend.
 */
export function createQueueBackend(): QueueBackend {
  if (backendInstance) return backendInstance;

  if (process.env.REDIS_HOST) {
    try {
      // Dynamic import to avoid crash if bullmq not installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { RedisQueueBackend } = require("./redis");
      backendInstance = new RedisQueueBackend() as QueueBackend;
      return backendInstance;
    } catch {
      // Fall through to in-memory
    }
  }

  backendInstance = new InMemoryQueueBackend();
  return backendInstance;
}

/**
 * Reset the backend instance (for testing).
 */
export function resetBackend(): void {
  backendInstance = null;
}

export { InMemoryQueueBackend } from "./in-memory";
export type { QueueBackend } from "./types";
