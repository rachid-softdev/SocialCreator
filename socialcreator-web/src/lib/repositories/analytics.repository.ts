/**
 * Analytics Repository
 * Interface + Prisma Implementation
 */

import type { Analytics, Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================
// Domain Types
// ============================================

export interface AnalyticsFilterOptions {
  profileId?: string;
  platform?: Platform;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export interface AnalyticsPage {
  items: Analytics[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// Repository Interface
// ============================================

export interface IAnalyticsRepository {
  findByProfileId(options: AnalyticsFilterOptions): Promise<AnalyticsPage>;
  getDailyStats(profileId: string, days: number): Promise<Analytics[]>;
  findByPlatform(platform: Platform, options: AnalyticsFilterOptions): Promise<AnalyticsPage>;
}

// ============================================
// Prisma Implementation
// ============================================

export class PrismaAnalyticsRepository implements IAnalyticsRepository {
  async findByProfileId(options: AnalyticsFilterOptions): Promise<AnalyticsPage> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const where: Record<string, unknown> = { profileId: options.profileId };

    if (options.platform) where.platform = options.platform;
    if (options.from || options.to) {
      const dateFilter: Record<string, Date> = {};
      if (options.from) dateFilter.gte = options.from;
      if (options.to) dateFilter.lte = options.to;
      where.date = dateFilter;
    }

    const [items, total] = await Promise.all([
      prisma.analytics.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.analytics.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getDailyStats(profileId: string, days: number): Promise<Analytics[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return prisma.analytics.findMany({
      where: {
        profileId,
        date: { gte: since },
      },
      orderBy: { date: "asc" },
    });
  }

  async findByPlatform(platform: Platform, options: AnalyticsFilterOptions): Promise<AnalyticsPage> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const where: Record<string, unknown> = { platform };

    if (options.profileId) where.profileId = options.profileId;
    if (options.from || options.to) {
      const dateFilter: Record<string, Date> = {};
      if (options.from) dateFilter.gte = options.from;
      if (options.to) dateFilter.lte = options.to;
      where.date = dateFilter;
    }

    const [items, total] = await Promise.all([
      prisma.analytics.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.analytics.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
