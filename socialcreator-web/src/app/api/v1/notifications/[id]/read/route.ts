/**
 * API v1 /notifications/[id]/read route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { notFound, unauthorized } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// PATCH /api/v1/notifications/:id/read — Mark one notification as read
export const PATCH = withApiMiddleware(async ({ userId }, params) => {
  const { notification: notificationRepo } = getRepositories();
  const notification = await notificationRepo.findById(params?.id as string);

  if (!notification) return notFound("Notification");
  if (notification.userId !== userId) return unauthorized();

  const updated = await notificationRepo.markAsRead(notification.id);

  return NextResponse.json(
    { notification: updated },
    {
      headers: { "X-API-Version": "v1" },
    },
  );
});
