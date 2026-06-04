/**
 * Notification Repository
 * Interface + Prisma Implementation
 */

import type { Notification } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================
// Domain Types
// ============================================

export interface NotificationListOptions {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}

export interface NotificationPage {
  notifications: Notification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// Repository Interface
// ============================================

export interface INotificationRepository {
  findById(id: string): Promise<Notification | null>;
  findByUserId(userId: string, options?: NotificationListOptions): Promise<NotificationPage>;
  findUnreadByUserId(userId: string): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  create(data: CreateNotificationInput): Promise<Notification>;
  markAsRead(id: string): Promise<Notification>;
  markAllAsRead(userId: string): Promise<number>;
}

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
}

// ============================================
// Prisma Implementation
// ============================================

export class PrismaNotificationRepository implements INotificationRepository {
  async findById(id: string): Promise<Notification | null> {
    return prisma.notification.findUnique({ where: { id } });
  }

  async findByUserId(userId: string, options?: NotificationListOptions): Promise<NotificationPage> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const where: Record<string, unknown> = { userId };

    if (options?.unreadOnly) {
      where.read = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findUnreadByUserId(userId: string): Promise<Notification[]> {
    return prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async countUnread(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async create(data: CreateNotificationInput): Promise<Notification> {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message ?? null,
        data: (data.data ?? {}) as any,
      },
    });
  }

  async markAsRead(id: string): Promise<Notification> {
    return prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return result.count;
  }
}
