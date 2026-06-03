/**
 * API v1 /content/generate route
 * POST — Generate content via LLM, save as DRAFT, and return
 */

import { NextResponse } from "next/server";
import { fromZodError, notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { generateAndSaveContent } from "@/lib/content/generator";
import { tryIncrementGenerationUsage } from "@/lib/llm/rate-limiter";
import { getRepositories } from "@/lib/repositories";
import { generateContentSchema } from "@/lib/validations/generation";

// POST /api/v1/content/generate
export const POST = withApiMiddleware(async ({ userId, request }) => {
  const body = await request.json();

  // Validate input with Zod
  const validation = generateContentSchema.safeParse(body);
  if (!validation.success) {
    return fromZodError(validation.error);
  }

  const { profileId, platform, brief, count, keywords, brandVoice } = validation.data;

  // Ownership check
  const { profile: profileRepo } = getRepositories();
  const profile = await profileRepo.findById(profileId);
  if (!profile || profile.userId !== userId) {
    return notFound("Profile");
  }

  // Atomic quota check + increment (uses Redis INCRBY)
  const needed = count ?? 1;
  const quota = await tryIncrementGenerationUsage(userId, needed);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "Generation quota exceeded",
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

  // Generate content
  const contents = await generateAndSaveContent({
    profileId,
    platform,
    brief,
    count,
    keywords,
    brandVoice,
  });

  return NextResponse.json(
    {
      contents,
      quota: {
        used: quota.used,
        limit: quota.limit,
        remaining: quota.remaining,
        resetAt: quota.resetAt,
      },
    },
    {
      status: 201,
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
