/**
 * Agent + AgentRun Repository
 * Interfaces + Prisma Implementations
 */

import type { Agent, AgentRun, Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ============================================
// Domain Types
// ============================================

export type AgentWithProfile = Agent & {
  profile: { id: string; name: string };
};

export type AgentRunWithContent = AgentRun & {
  generatedContents: Array<{ id: string; platform: string; status: string }>;
};

// ============================================
// Agent Repository
// ============================================

export interface IAgentRepository {
  findById(id: string): Promise<AgentWithProfile | null>;
  findByProfileId(profileId: string): Promise<Agent[]>;
  create(data: CreateAgentInput): Promise<Agent>;
  update(id: string, data: UpdateAgentInput): Promise<Agent>;
  delete(id: string): Promise<void>;
  findActiveByPlatform(platform: Platform): Promise<Agent[]>;
}

export interface CreateAgentInput {
  profileId: string;
  name: string;
  type: string;
  platforms: Platform[];
  scheduleCron?: string | null;
  autoPublish?: boolean;
  maxPerDay?: number;
  config?: Record<string, unknown>;
}

export interface UpdateAgentInput {
  name?: string;
  platforms?: Platform[];
  scheduleCron?: string | null;
  isActive?: boolean;
  autoPublish?: boolean;
  maxPerDay?: number;
  config?: Record<string, unknown>;
}

// ============================================
// AgentRun Repository
// ============================================

export interface IAgentRunRepository {
  findById(id: string): Promise<AgentRunWithContent | null>;
  findByAgentId(agentId: string): Promise<AgentRun[]>;
  create(data: CreateRunInput): Promise<AgentRun>;
  updateStatus(id: string, status: string, error?: string): Promise<AgentRun>;
}

export interface CreateRunInput {
  agentId: string;
  brief: string;
}

// ============================================
// Prisma Agent Implementation
// ============================================

export class PrismaAgentRepository implements IAgentRepository {
  async findById(id: string): Promise<AgentWithProfile | null> {
    return prisma.agent.findUnique({
      where: { id },
      include: { profile: { select: { id: true, name: true } } },
    });
  }

  async findByProfileId(profileId: string): Promise<Agent[]> {
    return prisma.agent.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: CreateAgentInput): Promise<Agent> {
    return prisma.agent.create({
      data: {
        profileId: data.profileId,
        name: data.name,
        type: data.type as any,
        platforms: data.platforms,
        scheduleCron: data.scheduleCron ?? null,
        autoPublish: data.autoPublish ?? false,
        maxPerDay: data.maxPerDay ?? 2,
        config: (data.config ?? {}) as any,
      },
    });
  }

  async update(id: string, data: UpdateAgentInput): Promise<Agent> {
    return prisma.agent.update({ where: { id }, data: data as any });
  }

  async delete(id: string): Promise<void> {
    await prisma.agent.delete({ where: { id } });
  }

  async findActiveByPlatform(platform: Platform): Promise<Agent[]> {
    return prisma.agent.findMany({
      where: { isActive: true, platforms: { has: platform } },
      include: { profile: { select: { id: true, name: true, userId: true } } },
    });
  }
}

// ============================================
// Prisma AgentRun Implementation
// ============================================

export class PrismaAgentRunRepository implements IAgentRunRepository {
  async findById(id: string): Promise<AgentRunWithContent | null> {
    return prisma.agentRun.findUnique({
      where: { id },
      include: {
        generatedContents: {
          select: { id: true, platform: true, status: true },
        },
      },
    }) as Promise<AgentRunWithContent | null>;
  }

  async findByAgentId(agentId: string): Promise<AgentRun[]> {
    return prisma.agentRun.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: CreateRunInput): Promise<AgentRun> {
    return prisma.agentRun.create({
      data: {
        agentId: data.agentId,
        brief: data.brief,
      },
    });
  }

  async updateStatus(id: string, status: string, error?: string): Promise<AgentRun> {
    const updateData: Record<string, unknown> = { status };

    if (status === "RUNNING") updateData.startedAt = new Date();
    if (status === "SUCCESS" || status === "FAILED" || status === "CANCELLED") {
      updateData.finishedAt = new Date();
    }
    if (error) updateData.error = error;

    return prisma.agentRun.update({ where: { id }, data: updateData as any });
  }
}
