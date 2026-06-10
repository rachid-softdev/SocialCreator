/**
 * Profile Repository
 * Interface + Prisma Implementation
 */

import type { Platform, Profile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCacheService } from "@/lib/infrastructure/cache";

// ============================================
// Domain Types
// ============================================

export type ProfileWithRelations = Profile & {
  connectedAccounts?: Array<{
    id: string;
    platform: Platform;
    accountName: string;
    isActive: boolean;
  }>;
  agents?: Array<{ id: string; name: string; isActive: boolean }>;
};

// ============================================
// Repository Interface
// ============================================

export interface IProfileRepository {
  findById(id: string): Promise<ProfileWithRelations | null>;
  findByUserId(userId: string): Promise<Profile[]>;
  create(data: CreateProfileInput): Promise<Profile>;
  update(id: string, data: UpdateProfileInput): Promise<Profile>;
  delete(id: string): Promise<void>;
  countByUserId(userId: string): Promise<number>;
}

export interface CreateProfileInput {
  userId: string;
  name: string;
  brandVoice: string;
  contentBank?: string;
  platforms?: Platform[];
  avatarUrl?: string;
  teamId?: string;
}

export interface UpdateProfileInput {
  name?: string;
  brandVoice?: string;
  contentBank?: string;
  platforms?: Platform[];
  avatarUrl?: string;
  isActive?: boolean;
  teamId?: string | null;
}

// ============================================
// Prisma Implementation
// ============================================

export class PrismaProfileRepository implements IProfileRepository {
  async findById(id: string): Promise<ProfileWithRelations | null> {
    const cacheKey = `cache:profile:${id}`;
    const cache = getCacheService();

    const cached = await cache.get<ProfileWithRelations>(cacheKey);
    if (cached) return cached;

    const profile = await prisma.profile.findUnique({
      where: { id },
      include: {
        connectedAccounts: {
          select: { id: true, platform: true, accountName: true, isActive: true },
        },
        agents: {
          select: { id: true, name: true, isActive: true },
        },
      },
    });

    if (profile) {
      await cache.set(cacheKey, profile, 600);
    }

    return profile;
  }

  async findByUserId(userId: string): Promise<Profile[]> {
    return prisma.profile.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: CreateProfileInput): Promise<Profile> {
    return prisma.profile.create({
      data: {
        userId: data.userId,
        name: data.name,
        brandVoice: data.brandVoice,
        contentBank: data.contentBank ?? null,
        platforms: data.platforms ?? [],
        avatarUrl: data.avatarUrl ?? null,
        teamId: data.teamId ?? null,
      },
    });
  }

  async update(id: string, data: UpdateProfileInput): Promise<Profile> {
    const profile = await prisma.profile.update({ where: { id }, data: data as any });

    await getCacheService().del(`cache:profile:${id}`);

    return profile;
  }

  async delete(id: string): Promise<void> {
    await prisma.profile.delete({ where: { id } });
  }

  async countByUserId(userId: string): Promise<number> {
    return prisma.profile.count({ where: { userId } });
  }
}
