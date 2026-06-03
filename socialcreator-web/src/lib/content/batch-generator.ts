/**
 * Batch Content Generator
 * Enqueues individual content-generate jobs for each platform
 */

import type { Platform } from "@prisma/client";
import { enqueueJob } from "@/lib/job-queue";

// ── Types ──────────────────────────────────────────────────────

export interface BatchGenerateInput {
  userId: string;
  profileId: string;
  brief: string;
  platforms: Platform[];
  count?: number;
  keywords?: string[];
  brandVoice?: string;
}

export interface BatchGenerateResult {
  batchId: string;
  jobIds: string[];
  total: number;
}

// ── Batch generator ─────────────────────────────────────────────

/**
 * Enqueue a batch of content generation jobs, one per platform.
 * Returns a batch ID and the list of job IDs for tracking.
 */
export async function enqueueBatchJobs(input: BatchGenerateInput): Promise<BatchGenerateResult> {
  const batchId = crypto.randomUUID();
  const jobIds: string[] = [];

  for (const platform of input.platforms) {
    const jobId = enqueueJob("content-generate", {
      userId: input.userId,
      profileId: input.profileId,
      platform,
      brief: input.brief,
      keywords: input.keywords,
      brandVoice: input.brandVoice,
      count: input.count ?? 1,
      agentId: "",
    });
    jobIds.push(jobId);
  }

  return { batchId, jobIds, total: jobIds.length };
}
