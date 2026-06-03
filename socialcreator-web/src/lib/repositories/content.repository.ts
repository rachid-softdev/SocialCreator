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
}
