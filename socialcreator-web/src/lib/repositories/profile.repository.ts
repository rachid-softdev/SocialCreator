/**
 * Profile Repository
 * Interface + Prisma Implementation
 */

import type { Platform, Profile } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
    return prisma.profile.findUnique({
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
    return prisma.profile.update({ where: { id }, data: data as any });
  }

  async delete(id: string): Promise<void> {
    await prisma.profile.delete({ where: { id } });
  }

  async countByUserId(userId: string): Promise<number> {
    return prisma.profile.count({ where: { userId } });
  }
}
