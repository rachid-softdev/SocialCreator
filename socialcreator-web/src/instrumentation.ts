/**
 * Next.js Instrumentation Hook
 * Runs on server startup to initialize services
 */

import { startMemoryCacheCleanup } from "@/lib/entitlements/cache";
import { startWorker } from "@/lib/job-queue";
import { createScheduler } from "@/lib/services/scheduler";

let scheduler: ReturnType<typeof createScheduler> | null = null;
let cleanupCache: (() => void) | null = null;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    startWorker();
    scheduler = createScheduler();
    scheduler.start();
    cleanupCache = startMemoryCacheCleanup();
  }
}

export async function deregister() {
  if (cleanupCache) {
    cleanupCache();
    cleanupCache = null;
  }
}
