/**
 * TeamMember Repository
 * Interface + Prisma Implementation
 */

import type { TeamMember, TeamRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================
// Repository Interface
// ============================================

export interface ITeamMemberRepository {
  findById(id: string): Promise<TeamMember | null>;
  findByTeamId(teamId: string): Promise<TeamMember[]>;
  findByUserId(userId: string): Promise<TeamMember[]>;
  addMember(data: AddTeamMemberInput): Promise<TeamMember>;
  updateRole(id: string, role: TeamRole): Promise<TeamMember>;
  removeMember(id: string): Promise<void>;
}

export interface AddTeamMemberInput {
  teamId: string;
  userId: string;
  role?: TeamRole;
}

// ============================================
// Prisma Implementation
// ============================================

export class PrismaTeamMemberRepository implements ITeamMemberRepository {
  async findById(id: string): Promise<TeamMember | null> {
    return prisma.teamMember.findUnique({ where: { id } });
  }

  async findByTeamId(teamId: string): Promise<TeamMember[]> {
    return prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { invitedAt: "desc" },
    });
  }

  async findByUserId(userId: string): Promise<TeamMember[]> {
    return prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: { select: { id: true, name: true } },
      },
      orderBy: { invitedAt: "desc" },
    });
  }

  async addMember(data: AddTeamMemberInput): Promise<TeamMember> {
    return prisma.teamMember.create({
      data: {
        teamId: data.teamId,
        userId: data.userId,
        role: data.role ?? "VIEWER",
      },
    });
  }

  async updateRole(id: string, role: TeamRole): Promise<TeamMember> {
    return prisma.teamMember.update({ where: { id }, data: { role } });
  }

  async removeMember(id: string): Promise<void> {
    await prisma.teamMember.delete({ where: { id } });
  }
}
