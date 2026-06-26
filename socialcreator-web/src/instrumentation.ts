/**
 * Next.js Instrumentation Hook
 * Runs on server startup to initialize services
 *
 * Uses dynamic imports to prevent webpack from bundling Node.js-specific
 * modules (e.g., job-queue, scheduler) for the Edge runtime, where
 * built-ins like crypto are unavailable.
 */

let cleanup: (() => void) | null = null;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ startWorker }, { createScheduler }, { startMemoryCacheCleanup }] = await Promise.all([
      import("@/lib/job-queue"),
      import("@/lib/services/scheduler"),
      import("@/lib/entitlements/cache"),
    ]);

    startWorker();
    const scheduler = createScheduler();
    scheduler.start();
    cleanup = startMemoryCacheCleanup();
  }
}

export async function deregister() {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
}
