/**
 * PublishLog Repository
 * Interface + Prisma Implementation
 */

import type { Platform, PublishLog } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================
// Domain Types
// ============================================

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

// ============================================
// Repository Interface
// ============================================

export interface IPublishLogRepository {
  findById(id: string): Promise<PublishLog | null>;
  findByUserId(userId: string, options?: PaginationOptions): Promise<PublishLog[]>;
  findByProfileId(profileId: string, options?: PaginationOptions): Promise<PublishLog[]>;
  create(data: CreatePublishLogInput): Promise<PublishLog>;
  countPublishedToday(profileId: string, platform: Platform): Promise<number>;
  findByContentHash(hash: string): Promise<PublishLog | null>;
}

export interface CreatePublishLogInput {
  userId: string;
  profileId: string;
  platform: Platform;
  contentId: string;
  contentHash: string;
  success: boolean;
  error?: string;
}

// ============================================
// Prisma Implementation
// ============================================

export class PrismaPublishLogRepository implements IPublishLogRepository {
  async findById(id: string): Promise<PublishLog | null> {
    return prisma.publishLog.findUnique({ where: { id } });
  }

  async findByUserId(userId: string, options?: PaginationOptions): Promise<PublishLog[]> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;

    return prisma.publishLog.findMany({
      where: { userId },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async findByProfileId(profileId: string, options?: PaginationOptions): Promise<PublishLog[]> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;

    return prisma.publishLog.findMany({
      where: { profileId },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async create(data: CreatePublishLogInput): Promise<PublishLog> {
    return prisma.publishLog.create({
      data: {
        userId: data.userId,
        profileId: data.profileId,
        platform: data.platform,
        contentId: data.contentId,
        contentHash: data.contentHash,
        success: data.success,
        error: data.error ?? null,
      },
    });
  }

  async countPublishedToday(profileId: string, platform: Platform): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return prisma.publishLog.count({
      where: {
        profileId,
        platform,
        success: true,
        publishedAt: { gte: startOfDay },
      },
    });
  }

  async findByContentHash(hash: string): Promise<PublishLog | null> {
    return prisma.publishLog.findFirst({
      where: { contentHash: hash },
      orderBy: { publishedAt: "desc" },
    });
  }
}
