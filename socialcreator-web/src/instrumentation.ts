/**
 * Next.js Instrumentation Hook
 * Runs on server startup to initialize services
 */
import { startWorker } from "@/lib/job-queue";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    startWorker();
  }
}
