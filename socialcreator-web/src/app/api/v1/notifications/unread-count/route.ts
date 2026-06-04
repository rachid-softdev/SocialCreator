/**
 * API v1 /notifications/unread-count route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/notifications/unread-count — Count unread notifications
export const GET = withApiMiddleware(async ({ userId }) => {
  const { notification: notificationRepo } = getRepositories();
  const count = await notificationRepo.countUnread(userId);

  return NextResponse.json(
    { count },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
