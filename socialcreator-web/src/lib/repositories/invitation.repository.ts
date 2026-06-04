/**
 * Invitation Repository
 * Interface + Prisma Implementation
 */

import type { Invitation, InvitationStatus, TeamRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================
// Repository Interface
// ============================================

export interface IInvitationRepository {
  findById(id: string): Promise<Invitation | null>;
  findByToken(token: string): Promise<Invitation | null>;
  findByTeamId(teamId: string): Promise<Invitation[]>;
  findByEmail(email: string): Promise<Invitation[]>;
  findPendingByEmail(email: string): Promise<Invitation[]>;
  findPendingByTeamIdAndEmail(teamId: string, email: string): Promise<Invitation | null>;
  create(data: CreateInvitationInput): Promise<Invitation>;
  updateStatus(id: string, status: InvitationStatus): Promise<Invitation>;
}

export interface CreateInvitationInput {
  teamId: string;
  invitedByUserId: string;
  email: string;
  role: TeamRole;
  token: string;
  expiresAt: Date;
}

// ============================================
// Prisma Implementation
// ============================================

export class PrismaInvitationRepository implements IInvitationRepository {
  async findById(id: string): Promise<Invitation | null> {
    return prisma.invitation.findUnique({ where: { id } });
  }

  async findByToken(token: string): Promise<Invitation | null> {
    return prisma.invitation.findUnique({ where: { token } });
  }

  async findByTeamId(teamId: string): Promise<Invitation[]> {
    return prisma.invitation.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByEmail(email: string): Promise<Invitation[]> {
    return prisma.invitation.findMany({
      where: { email },
      orderBy: { createdAt: "desc" },
    });
  }

  async findPendingByEmail(email: string): Promise<Invitation[]> {
    return prisma.invitation.findMany({
      where: {
        email,
        status: "PENDING",
        expiresAt: { gte: new Date() },
      },
      include: {
        team: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findPendingByTeamIdAndEmail(teamId: string, email: string): Promise<Invitation | null> {
    return prisma.invitation.findFirst({
      where: {
        teamId,
        email,
        status: "PENDING",
        expiresAt: { gte: new Date() },
      },
    });
  }

  async create(data: CreateInvitationInput): Promise<Invitation> {
    return prisma.invitation.create({ data });
  }

  async updateStatus(id: string, status: InvitationStatus): Promise<Invitation> {
    return prisma.invitation.update({
      where: { id },
      data: {
        status,
        ...(status === "ACCEPTED" ? { acceptedAt: new Date() } : {}),
        ...(status === "REJECTED" ? { rejectedAt: new Date() } : {}),
      },
    });
  }
}
