/**
 * Team Repository
 * Interface + Prisma Implementation
 */

import type { Team } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================
// Domain Types
// ============================================

export type TeamWithMembers = Team & {
  members: Array<{
    id: string;
    userId: string;
    role: string;
    user: { id: string; name: string | null; email: string };
  }>;
};

// ============================================
// Repository Interface
// ============================================

export interface ITeamRepository {
  findById(id: string): Promise<TeamWithMembers | null>;
  findByOwnerId(ownerId: string): Promise<Team[]>;
  create(data: CreateTeamInput): Promise<Team>;
  update(id: string, data: Partial<Team>): Promise<Team>;
  delete(id: string): Promise<void>;
}

export interface CreateTeamInput {
  name: string;
  ownerId: string;
}

// ============================================
// Prisma Implementation
// ============================================

export class PrismaTeamRepository implements ITeamRepository {
  async findById(id: string): Promise<TeamWithMembers | null> {
    return prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  }

  async findByOwnerId(ownerId: string): Promise<Team[]> {
    return prisma.team.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: CreateTeamInput): Promise<Team> {
    return prisma.team.create({
      data: {
        name: data.name,
        ownerId: data.ownerId,
      },
    });
  }

  async update(id: string, data: Partial<Team>): Promise<Team> {
    return prisma.team.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await prisma.team.delete({ where: { id } });
  }
}
