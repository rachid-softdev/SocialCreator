/**
 * PublishLog Repository
 * Interface + Prisma Implementation
 */

import type { Platform, PublishLog } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCacheService } from "@/lib/infrastructure/cache";
import { getRedis } from "@/lib/infrastructure/rate-limit-redis";

// ============================================
// Domain Types
// ============================================

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface PublishLogPage {
  logs: PublishLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DailyStatsItem {
  date: string;
  success: number;
  failed: number;
}

// ============================================
// Repository Interface
// ============================================

export interface IPublishLogRepository {
  findById(id: string): Promise<PublishLog | null>;
  findByUserId(userId: string, options?: PaginationOptions): Promise<PublishLogPage>;
  findByProfileId(profileId: string, options?: PaginationOptions): Promise<PublishLog[]>;
  create(data: CreatePublishLogInput): Promise<PublishLog>;
  countPublishedToday(profileId: string, platform: Platform): Promise<number>;
  findByContentHash(hash: string): Promise<PublishLog | null>;
  findSuccessfulByContentHash(hash: string, profileId: string): Promise<PublishLog | null>;
  getDailyStats(userId: string, days: number): Promise<DailyStatsItem[]>;
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

  async findByUserId(userId: string, options?: PaginationOptions): Promise<PublishLogPage> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const where = { userId };

    const [logs, total] = await Promise.all([
      prisma.publishLog.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.publishLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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
    const log = await prisma.publishLog.create({
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

    await this.invalidateDailyStatsCache(data.userId);

    return log;
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

  async getDailyStats(userId: string, days: number): Promise<DailyStatsItem[]> {
    const cacheKey = `cache:publishlog:dailystats:${userId}:${days}`;
    const cache = getCacheService();

    const cached = await cache.get<DailyStatsItem[]>(cacheKey);
    if (cached) return cached;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await prisma.publishLog.findMany({
      where: {
        userId,
        publishedAt: { gte: since },
      },
      orderBy: { publishedAt: "asc" },
    });

    // Initialize all days
    const grouped: Record<string, { success: number; failed: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      grouped[key] = { success: 0, failed: 0 };
    }

    // Fill in actual data
    for (const log of logs) {
      const key = log.publishedAt.toISOString().split("T")[0];
      if (grouped[key]) {
        if (log.success) grouped[key].success++;
        else grouped[key].failed++;
      }
    }

    const result = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    await cache.set(cacheKey, result, 300);

    return result;
  }

  async invalidateDailyStatsCache(userId: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    const pattern = `cache:publishlog:dailystats:${userId}:*`;
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = Number(nextCursor);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== 0);
  }

  async findByContentHash(hash: string): Promise<PublishLog | null> {
    return prisma.publishLog.findFirst({
      where: { contentHash: hash },
      orderBy: { publishedAt: "desc" },
    });
  }

  async findSuccessfulByContentHash(hash: string, profileId: string): Promise<PublishLog | null> {
    return prisma.publishLog.findFirst({
      where: { contentHash: hash, profileId, success: true },
    });
  }
}
