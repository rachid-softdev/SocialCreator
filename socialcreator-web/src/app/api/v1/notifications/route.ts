/**
 * API v1 /notifications route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/notifications — List notifications
export const GET = withApiMiddleware(async ({ userId, request }) => {
  const { notification: notificationRepo } = getRepositories();
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";

  const result = await notificationRepo.findByUserId(userId, {
    page,
    pageSize,
    unreadOnly: unreadOnly || undefined,
  });

  return NextResponse.json(
    { ...result },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
