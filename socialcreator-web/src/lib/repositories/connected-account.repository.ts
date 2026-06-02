/**
 * ConnectedAccount Repository
 * Interface + Prisma Implementation
 */

import type { ConnectedAccount, Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================
// Repository Interface
// ============================================

export interface IConnectedAccountRepository {
  findById(id: string): Promise<ConnectedAccount | null>;
  findByProfileId(profileId: string): Promise<ConnectedAccount[]>;
  findByProfileAndPlatform(profileId: string, platform: Platform): Promise<ConnectedAccount | null>;
  create(data: CreateConnectedAccountInput): Promise<ConnectedAccount>;
  update(id: string, data: Partial<ConnectedAccount>): Promise<ConnectedAccount>;
  delete(id: string): Promise<void>;
}

export interface CreateConnectedAccountInput {
  profileId: string;
  platform: Platform;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountId: string;
  accountName: string;
  accountAvatarUrl?: string;
}

// ============================================
// Prisma Implementation
// ============================================

export class PrismaConnectedAccountRepository implements IConnectedAccountRepository {
  async findById(id: string): Promise<ConnectedAccount | null> {
    return prisma.connectedAccount.findUnique({ where: { id } });
  }

  async findByProfileId(profileId: string): Promise<ConnectedAccount[]> {
    return prisma.connectedAccount.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByProfileAndPlatform(
    profileId: string,
    platform: Platform,
  ): Promise<ConnectedAccount | null> {
    return prisma.connectedAccount.findUnique({
      where: { profileId_platform: { profileId, platform } },
    });
  }

  async create(data: CreateConnectedAccountInput): Promise<ConnectedAccount> {
    return prisma.connectedAccount.create({
      data: {
        profileId: data.profileId,
        platform: data.platform,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        expiresAt: data.expiresAt ?? null,
        accountId: data.accountId,
        accountName: data.accountName,
        accountAvatarUrl: data.accountAvatarUrl ?? null,
      },
    });
  }

  async update(id: string, data: Partial<ConnectedAccount>): Promise<ConnectedAccount> {
    return prisma.connectedAccount.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await prisma.connectedAccount.delete({ where: { id } });
  }
}
