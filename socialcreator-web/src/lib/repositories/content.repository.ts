/**
 * GeneratedContent Repository
 * Interface + Prisma Implementation
 */

import type { ContentStatus, GeneratedContent, Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================
// Domain Types
// ============================================

export interface ContentFilterOptions {
  page?: number;
  pageSize?: number;
  status?: ContentStatus;
  platform?: Platform;
}

export interface ContentPage {
  contents: GeneratedContent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// Repository Interface
// ============================================

export interface IContentRepository {
  findById(id: string): Promise<GeneratedContent | null>;
  findByProfileId(profileId: string, options?: ContentFilterOptions): Promise<ContentPage>;
  findByUserId(userId: string, options?: ContentFilterOptions): Promise<ContentPage>;
  create(data: GeneratedContentCreateInput): Promise<GeneratedContent>;
  update(id: string, data: UpdateContentInput): Promise<GeneratedContent>;
  updateStatus(id: string, status: ContentStatus): Promise<GeneratedContent>;
  schedule(id: string, scheduledPublishAt: Date): Promise<GeneratedContent>;
  delete(id: string): Promise<void>;
  findPendingScheduled(before: Date): Promise<GeneratedContent[]>;
  countPublishedToday(profileId: string, platform: Platform): Promise<number>;
  findByRunId(runId: string): Promise<GeneratedContent[]>;
  /** Find SCHEDULED content within a time window for a profile */
  findScheduledByProfileAndTime(profileId: string, start: Date, end: Date): Promise<GeneratedContent[]>;
  /** Find SCHEDULED content by date range for a user, optionally filtered by platform */
  findScheduledByDateRange(userId: string, from: Date, to: Date, platform?: string): Promise<GeneratedContent[]>;
  /** Find FAILED content with optional profile filter and pagination */
  findFailed(options?: { page?: number; pageSize?: number; profileId?: string }): Promise<ContentPage>;
  /** Reset content status from FAILED back to APPROVED (for retry) */
  resetToApproved(id: string): Promise<GeneratedContent>;
  /** Cancel a schedule (set scheduledPublishAt=null, status=APPROVED) */
  cancelSchedule(id: string): Promise<GeneratedContent>;
  /** Find schedule-conflicting content — returns count only */
  countScheduledAtTime(profileId: string, time: Date): Promise<number>;
  /** Batch update scheduled times — returns count updated */
  batchReschedule(items: Array<{ id: string; scheduledPublishAt: Date }>): Promise<number>;
}

type GeneratedContentCreateInput = Omit<
  Parameters<typeof prisma.generatedContent.create>[0]["data"],
  "id"
>;

export type UpdateContentInput = Partial<{
  textContent: string;
  hashtags: string[];
  mediaUrls: string[];
  status: ContentStatus;
  postId: string;
  scheduledPublishAt: Date;
  scheduledTimezone: string;
  rejectedAt: Date;
}>;

// ============================================
// Prisma Implementation
// ============================================

export class PrismaContentRepository implements IContentRepository {
  async findById(id: string): Promise<GeneratedContent | null> {
    return prisma.generatedContent.findUnique({
      where: { id },
      include: {
        profile: { select: { id: true, name: true } },
        run: {
          select: {
            id: true,
            agent: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async findByProfileId(profileId: string, options?: ContentFilterOptions): Promise<ContentPage> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const where: Record<string, unknown> = { profileId };

    if (options?.status) where.status = options.status;
    if (options?.platform) where.platform = options.platform;

    const [contents, total] = await Promise.all([
      prisma.generatedContent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { profile: { select: { id: true, name: true } } },
      }),
      prisma.generatedContent.count({ where }),
    ]);

    return {
      contents,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findByUserId(userId: string, options?: ContentFilterOptions): Promise<ContentPage> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const where: Record<string, unknown> = {
      profile: { userId },
    };

    if (options?.status) where.status = options.status;
    if (options?.platform) where.platform = options.platform;

    const [contents, total] = await Promise.all([
      prisma.generatedContent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          profile: { select: { id: true, name: true } },
          run: {
            select: {
              id: true,
              agent: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.generatedContent.count({ where }),
    ]);

    return {
      contents,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async create(data: GeneratedContentCreateInput): Promise<GeneratedContent> {
    return prisma.generatedContent.create({ data: data as any });
  }

  async update(id: string, data: UpdateContentInput): Promise<GeneratedContent> {
    return prisma.generatedContent.update({ where: { id }, data: data as any });
  }

  async updateStatus(id: string, status: ContentStatus): Promise<GeneratedContent> {
    return prisma.generatedContent.update({ where: { id }, data: { status } });
  }

  async schedule(id: string, scheduledPublishAt: Date): Promise<GeneratedContent> {
    return prisma.generatedContent.update({
      where: { id },
      data: { status: "SCHEDULED", scheduledPublishAt },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.generatedContent.delete({ where: { id } });
  }

  async findPendingScheduled(before: Date): Promise<GeneratedContent[]> {
    return prisma.generatedContent.findMany({
      where: { status: "SCHEDULED", scheduledPublishAt: { lte: before } },
    });
  }

  async countPublishedToday(profileId: string, platform: Platform): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return prisma.generatedContent.count({
      where: {
        profileId,
        platform,
        status: "PUBLISHED",
        publishedAt: { gte: startOfDay },
      },
    });
  }

  async findByRunId(runId: string): Promise<GeneratedContent[]> {
    return prisma.generatedContent.findMany({
      where: { runId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findScheduledByProfileAndTime(
    profileId: string,
    start: Date,
    end: Date,
  ): Promise<GeneratedContent[]> {
    return prisma.generatedContent.findMany({
      where: {
        profileId,
        status: "SCHEDULED",
        scheduledPublishAt: { gte: start, lte: end },
      },
      orderBy: { scheduledPublishAt: "asc" },
    });
  }

  async findScheduledByDateRange(
    userId: string,
    from: Date,
    to: Date,
    platform?: string,
  ): Promise<GeneratedContent[]> {
    const where: Record<string, unknown> = {
      status: "SCHEDULED",
      scheduledPublishAt: { gte: from, lte: to },
      profile: { userId },
    };

    if (platform) {
      where.platform = platform;
    }

    return prisma.generatedContent.findMany({
      where,
      orderBy: { scheduledPublishAt: "asc" },
      include: { profile: { select: { id: true, name: true } } },
    });
  }

  async findFailed(
    options: { page?: number; pageSize?: number; profileId?: string } = {},
  ): Promise<ContentPage> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const where: Record<string, unknown> = { status: "FAILED" };

    if (options.profileId) where.profileId = options.profileId;

    const [contents, total] = await Promise.all([
      prisma.generatedContent.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { profile: { select: { id: true, name: true } } },
      }),
      prisma.generatedContent.count({ where }),
    ]);

    return {
      contents,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async resetToApproved(id: string): Promise<GeneratedContent> {
    return prisma.generatedContent.update({
      where: { id },
      data: { status: "APPROVED" },
    });
  }

  async cancelSchedule(id: string): Promise<GeneratedContent> {
    return prisma.generatedContent.update({
      where: { id },
      data: { status: "APPROVED", scheduledPublishAt: null },
    });
  }

  async countScheduledAtTime(profileId: string, time: Date): Promise<number> {
    return prisma.generatedContent.count({
      where: {
        profileId,
        status: "SCHEDULED",
        scheduledPublishAt: { equals: time },
      },
    });
  }

  async batchReschedule(
    items: Array<{ id: string; scheduledPublishAt: Date }>,
  ): Promise<number> {
    if (items.length === 0) return 0;

    const updates = items.map((item) =>
      prisma.generatedContent.update({
        where: { id: item.id },
        data: { scheduledPublishAt: item.scheduledPublishAt },
      }),
    );

    const results = await Promise.all(updates);
    return results.length;
  }
}
