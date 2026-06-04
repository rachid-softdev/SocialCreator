/**
 * Notification Service
 * Creates notifications and optionally publishes to Redis for real-time delivery
 */

import type { Notification } from "@prisma/client";
import { getRedis } from "@/lib/infrastructure/rate-limit-redis";
import logger from "@/lib/logger";
import { getRepositories } from "@/lib/repositories";

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
}

/**
 * Create a notification for a single user
 * Persists to database and publishes to Redis for real-time delivery
 */
export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  const { notification: notificationRepo } = getRepositories();

  const notification = await notificationRepo.create({
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    data: input.data,
  });

  // Publish to Redis for real-time delivery
  await publishToRedis(input.userId, notification);

  return notification;
}

/**
 * Create notifications for multiple users
 * Useful for broadcasting team events
 */
export async function broadcastNotification(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">,
): Promise<Notification[]> {
  const notifications = await Promise.all(
    userIds.map((userId) =>
      createNotification({
        ...input,
        userId,
      }),
    ),
  );

  return notifications;
}

/**
 * Publish notification event to Redis pub/sub channel
 * The SSE endpoint subscribes to user:{userId}:notifications
 */
async function publishToRedis(userId: string, notification: Notification): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) {
      // Redis not configured — real-time delivery unavailable, but notification is persisted
      logger.debug(
        { userId, notificationId: notification.id },
        "Redis not configured, skipping real-time notification delivery",
      );
      return;
    }

    const channel = `user:${userId}:notifications`;
    await redis.publish(
      channel,
      JSON.stringify({
        type: "new_notification",
        notification: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          read: notification.read,
          createdAt: notification.createdAt,
        },
      }),
    );
  } catch (error) {
    // Non-critical: don't let notification delivery failure bubble up
    logger.error(
      { err: error, userId, notificationId: notification.id },
      "Failed to publish notification to Redis",
    );
  }
}
