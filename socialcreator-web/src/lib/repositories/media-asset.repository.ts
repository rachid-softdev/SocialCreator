/**
 * MediaAsset + VideoAsset Repository
 * Interface + Prisma Implementation
 */

import type { MediaAsset, MediaType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================
// Repository Interface
// ============================================

export interface IMediaAssetRepository {
  findById(id: string): Promise<MediaAsset | null>;
  findByProfileId(profileId: string, type?: MediaType): Promise<MediaAsset[]>;
  create(data: CreateMediaAssetInput): Promise<MediaAsset>;
  delete(id: string): Promise<void>;
}

export interface CreateMediaAssetInput {
  profileId: string;
  type: MediaType;
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

// ============================================
// Prisma Implementation
// ============================================

export class PrismaMediaAssetRepository implements IMediaAssetRepository {
  async findById(id: string): Promise<MediaAsset | null> {
    return prisma.mediaAsset.findUnique({ where: { id } });
  }

  async findByProfileId(profileId: string, type?: MediaType): Promise<MediaAsset[]> {
    const where: Record<string, unknown> = { profileId };
    if (type) where.type = type;

    return prisma.mediaAsset.findMany({
      where,
      orderBy: { uploadedAt: "desc" },
    });
  }

  async create(data: CreateMediaAssetInput): Promise<MediaAsset> {
    return prisma.mediaAsset.create({
      data: {
        profileId: data.profileId,
        type: data.type,
        url: data.url,
        filename: data.filename ?? null,
        mimeType: data.mimeType ?? null,
        size: data.size ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
        duration: data.duration ?? null,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.mediaAsset.delete({ where: { id } });
  }
}
