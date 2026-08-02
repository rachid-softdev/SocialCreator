/**
 * API v1 /content/scheduled-range route
 * GET — Fetch scheduled content within a date range for calendar view
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

const querySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  platform: z.string().optional(),
});

// GET /api/v1/content/scheduled-range?from=ISO&to=ISO&platform=OPTIONAL
export const GET = withApiMiddleware(async ({ userId, request }) => {
  const { searchParams } = new URL(request.url);

  const validation = querySchema.safeParse({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    platform: searchParams.get("platform") ?? undefined,
  });

  if (!validation.success) {
    return badRequest(validation.error.errors[0]!.message);
  }

  const { from, to, platform } = validation.data;

  const { content: contentRepo } = getRepositories();

  const contents = await contentRepo.findScheduledByDateRange(
    userId,
    new Date(from),
    new Date(to),
    platform,
  );

  // Map to calendar event format
  const calendarEvents = contents.map((c) => ({
    id: c.id,
    profileId: c.profileId,
    platform: c.platform,
    textContent: c.textContent,
    status: c.status,
    scheduledPublishAt: c.scheduledPublishAt,
    scheduledTimezone: c.scheduledTimezone,
  }));

  return NextResponse.json(
    { contents: calendarEvents },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
