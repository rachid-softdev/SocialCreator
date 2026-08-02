/**
 * API v1 /content route
 * Uses repository pattern instead of direct Prisma calls
 */

import { contentFilterSchema } from "@socialcreator/types";
import { NextResponse } from "next/server";
import { badRequest } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/content?profileId=xxx&status=DRAFT&page=1
export const GET = withApiMiddleware(async ({ userId, request }) => {
  const { searchParams } = new URL(request.url);

  // Extract raw values
  const rawFilters = {
    profileId: searchParams.get("profileId"),
    status: searchParams.get("status"),
    platform: searchParams.get("platform"),
    page: searchParams.get("page"),
    pageSize: searchParams.get("pageSize"),
  };

  // Validate filters with Zod
  const validation = contentFilterSchema.safeParse(rawFilters);

  if (!validation.success) {
    return badRequest(validation.error.errors[0]!.message);
  }

  const { profileId, status, platform, page, pageSize } = validation.data;

  // Use repository pattern
  const { content: contentRepo } = getRepositories();

  if (profileId) {
    // Profile-scoped query
    const data = await contentRepo.findByProfileId(profileId, {
      status: status || undefined,
      platform: platform || undefined,
      page,
      pageSize,
    });

    return NextResponse.json(
      {
        contents: data.contents,
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-API-Version": "v1",
        },
      },
    );
  }

  // Cross-profile query using findByUserId
  const data = await contentRepo.findByUserId(userId, {
    status: status || undefined,
    platform: platform || undefined,
    page,
    pageSize,
  });

  return NextResponse.json(
    {
      contents: data.contents,
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
