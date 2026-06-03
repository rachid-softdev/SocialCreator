/**
 * API v1 /content/generate/batch route
 * POST — Enqueue batch content generation jobs across multiple platforms
 */

import { NextResponse } from "next/server";
import { fromZodError, notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { enqueueBatchJobs } from "@/lib/content/batch-generator";
import { tryIncrementGenerationUsage } from "@/lib/llm/rate-limiter";
import { getRepositories } from "@/lib/repositories";
import { generateContentBatchSchema } from "@/lib/validations/generation";

// POST /api/v1/content/generate/batch
export const POST = withApiMiddleware(async ({ userId, request }) => {
  const body = await request.json();

  // Validate input with Zod
  const validation = generateContentBatchSchema.safeParse(body);
  if (!validation.success) {
    return fromZodError(validation.error);
  }

  const { profileId, brief, platforms, count, keywords, brandVoice } = validation.data;

  // Ownership check
  const { profile: profileRepo } = getRepositories();
  const profile = await profileRepo.findById(profileId);
  if (!profile || profile.userId !== userId) {
    return notFound("Profile");
  }

  // Atomic quota check + increment for the estimated total
  const estimatedNeeded = platforms.length * (count ?? 1);
  const quota = await tryIncrementGenerationUsage(userId, estimatedNeeded);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `Insufficient quota. Need ~${estimatedNeeded} but ${quota.remaining > 0 ? `only ${quota.remaining} remaining` : "quota exceeded"}.`,
        code: "LIMIT_REACHED",
        details: {
          used: quota.used,
          limit: quota.limit,
          remaining: quota.remaining,
          resetAt: quota.resetAt,
        },
      },
      { status: 402 },
    );
  }

  // Enqueue batch jobs
  const batchResult = await enqueueBatchJobs({
    userId,
    profileId,
    brief,
    platforms,
    count,
    keywords,
    brandVoice,
  });

  return NextResponse.json(
    {
      batchId: batchResult.batchId,
      jobIds: batchResult.jobIds,
      total: batchResult.total,
      message: `Enqueued ${batchResult.total} content generation jobs`,
    },
    {
      status: 202,
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
