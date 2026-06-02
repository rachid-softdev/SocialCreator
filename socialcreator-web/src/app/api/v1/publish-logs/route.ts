/**
 * API v1 /publish-logs route
 * Paginated publish history for the current user or a specific profile
 */

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

  if (profileId) {
    const logs = await publishLogRepo.findByProfileId(profileId, { page, pageSize });
    const total = await prisma.publishLog.count({ where: { profileId } });

    return NextResponse.json({
      logs,
      totalPages: Math.ceil(total / pageSize) || 1,
      page,
      pageSize,
    });
  }

  const result = await publishLogRepo.findByUserId(userId, { page, pageSize });
  return NextResponse.json({
    logs: result.logs,
    totalPages: result.totalPages,
    page: result.page,
    pageSize: result.pageSize,
  });
});
