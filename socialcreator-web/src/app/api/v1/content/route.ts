/**
 * API v1 /content route
 * Uses repository pattern instead of direct Prisma calls
 */

import { contentFilterSchema } from "@socialcreator/types";
import { NextResponse } from "next/server";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";
import { isValidUuid } from "@/lib/sanitize";

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
    return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
  }

  const { profileId, status, platform, page, pageSize } = validation.data;

  // Validate profileId if provided
  if (profileId && !isValidUuid(profileId)) {
    return NextResponse.json({ error: "Invalid profile ID" }, { status: 400 });
  }

  // Use repository pattern
  const { content: contentRepo } = getRepositories();

  // Ensure user can only see their own content
  const where: Record<string, unknown> = {
    profile: { userId },
  };

  if (profileId) where.profileId = profileId;
  if (status) where.status = status;
  if (platform) where.platform = platform;

  // For v1 we still use pagination from the repo's findByProfileId approach
  // but adapted for user-wide queries. We use prisma directly for this
  // cross-profile query since the repo is profile-scoped.
  // In a full migration, IContentRepository would grow a findByUserId method.
  const { prisma } = await import("@/lib/prisma");

  const [contents, total] = await Promise.all([
    prisma.generatedContent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        profile: { select: { id: true, name: true } },
        run: {
          select: {
            id: true,
            agent: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.generatedContent.count({ where }),
  ]);

  return NextResponse.json(
    {
      contents,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
