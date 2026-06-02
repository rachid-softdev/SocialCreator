/**
 * ApiKey Repository
 * Interface + Prisma Implementation
 */

import type { ApiKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================
// Repository Interface
// ============================================

export interface IApiKeyRepository {
  findById(id: string): Promise<ApiKey | null>;
  findByUserId(userId: string): Promise<ApiKey[]>;
  findByKeyHash(keyHash: string): Promise<ApiKey | null>;
  create(data: CreateApiKeyInput): Promise<ApiKey>;
  revoke(id: string): Promise<ApiKey>;
  updateLastUsed(id: string): Promise<void>;
}

export interface CreateApiKeyInput {
  userId: string;
  name: string;
  keyHash: string;
  prefix: string;
  expiresAt?: Date;
}

// ============================================
// Prisma Implementation
// ============================================

export class PrismaApiKeyRepository implements IApiKeyRepository {
  async findById(id: string): Promise<ApiKey | null> {
    return prisma.apiKey.findUnique({ where: { id } });
  }

  async findByUserId(userId: string): Promise<ApiKey[]> {
    return prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByKeyHash(keyHash: string): Promise<ApiKey | null> {
    return prisma.apiKey.findUnique({
      where: { keyHash },
    });
  }

  async create(data: CreateApiKeyInput): Promise<ApiKey> {
    return prisma.apiKey.create({
      data: {
        userId: data.userId,
        name: data.name,
        keyHash: data.keyHash,
        prefix: data.prefix,
        expiresAt: data.expiresAt ?? null,
      },
    });
  }

  async revoke(id: string): Promise<ApiKey> {
    return prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async updateLastUsed(id: string): Promise<void> {
    await prisma.apiKey.update({
      where: { id },
      data: { lastUsed: new Date() },
    });
  }
}
