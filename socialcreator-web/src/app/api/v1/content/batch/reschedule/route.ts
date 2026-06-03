/**
 * API v1 /content/batch/reschedule route
 * POST — Batch reschedule multiple content items
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

const batchRescheduleSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        scheduledPublishAt: z.string().datetime(),
      }),
    )
    .min(1, "At least one item is required")
    .max(100, "Maximum 100 items per request"),
});

// POST /api/v1/content/batch/reschedule
export const POST = withApiMiddleware(async ({ userId, request }) => {
  const body = await request.json();
  const validation = batchRescheduleSchema.safeParse(body);

  if (!validation.success) {
    return badRequest(validation.error.errors[0].message);
  }

  const { items } = validation.data;
  const { content: contentRepo, profile: profileRepo } = getRepositories();

  // Verify ownership for all items
  const verifiedItems: Array<{ id: string; scheduledPublishAt: Date }> = [];

  for (const item of items) {
    const content = await contentRepo.findById(item.id);
    if (!content) return notFound(`Content with id ${item.id}`);

    const profile = await profileRepo.findById(content.profileId);
    if (!profile || profile.userId !== userId) {
      return notFound(`Content with id ${item.id}`);
    }

    verifiedItems.push({
      id: item.id,
      scheduledPublishAt: new Date(item.scheduledPublishAt),
    });
  }

  // Batch update
  const updated = await contentRepo.batchReschedule(verifiedItems);

  return NextResponse.json(
    {
      updated,
      items: verifiedItems.map((i) => ({
        id: i.id,
        scheduledPublishAt: i.scheduledPublishAt.toISOString(),
      })),
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
