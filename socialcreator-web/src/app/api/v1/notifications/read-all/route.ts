/**
 * API v1 /notifications/read-all route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// PATCH /api/v1/notifications/read-all — Mark all notifications as read
export const PATCH = withApiMiddleware(async ({ userId }) => {
  const { notification: notificationRepo } = getRepositories();
  const updatedCount = await notificationRepo.markAllAsRead(userId);

  return NextResponse.json(
    { updatedCount },
    {
      headers: { "X-API-Version": "v1" },
    },
  );
});
