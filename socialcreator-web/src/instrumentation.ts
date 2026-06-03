/**
 * Next.js Instrumentation Hook
 * Runs on server startup to initialize services
 */
import { startWorker } from "@/lib/job-queue";
import { createScheduler } from "@/lib/services/scheduler";

let scheduler: ReturnType<typeof createScheduler> | null = null;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    startWorker();
    scheduler = createScheduler();
    scheduler.start();
  }
}
