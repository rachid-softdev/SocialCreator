/**
 * API v1 /publish-logs route
 * Paginated publish history for the current user or a specific profile
 */

import type { PublishLog } from "@prisma/client";
import { NextResponse } from "next/server";
import { withApiMiddleware } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/publish-logs?profileId=xxx&page=1&pageSize=20
export const GET = withApiMiddleware(async ({ userId, request }) => {
  const searchParams = request.nextUrl.searchParams;
  const profileId = searchParams.get("profileId");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("pageSize")) || 20));

  const { publishLog: publishLogRepo } = getRepositories();

  let logs: PublishLog[] = [];
  let total = 0;

  if (profileId) {
    logs = await publishLogRepo.findByProfileId(profileId, { page, pageSize });
    total = await prisma.publishLog.count({ where: { profileId } });
  } else {
    logs = await publishLogRepo.findByUserId(userId, { page, pageSize });
    total = await prisma.publishLog.count({ where: { userId } });
  }

  return NextResponse.json({
    logs,
    totalPages: Math.ceil(total / pageSize) || 1,
    page,
    pageSize,
  });
});
