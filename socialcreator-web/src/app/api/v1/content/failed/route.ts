/**
 * API v1 /content/failed route
 * GET — List failed content for the authenticated user
 */

import { NextResponse } from "next/server";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/content/failed?page=1&pageSize=20
export const GET = withApiMiddleware(async ({ userId, request }) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20", 10);

  const { content: contentRepo } = getRepositories();

  // Use findByUserId with FAILED status filter for ownership enforcement
  const data = await contentRepo.findByUserId(userId, {
    status: "FAILED",
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
