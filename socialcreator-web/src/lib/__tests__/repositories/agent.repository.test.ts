/**
 * Tests for PrismaAgentRepository and PrismaAgentRunRepository
 *
 * Verifies Prisma interaction patterns for both repository classes.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock prisma ──────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    agentRun: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import {
  PrismaAgentRepository,
  PrismaAgentRunRepository,
} from "@/lib/repositories/agent.repository";

// ── Repositories ─────────────────────────────────────────────────────────────

const agentRepo = new PrismaAgentRepository();
const runRepo = new PrismaAgentRunRepository();

// ═════════════════════════════════════════════════════════════════════════════
// PrismaAgentRepository
// ═════════════════════════════════════════════════════════════════════════════

describe("PrismaAgentRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("should return agent with profile when found", async () => {
      const mockAgent = {
        id: "agent-1",
        profileId: "profile-1",
        name: "Test Agent",
        type: "CONTENT_GENERATOR",
        platforms: ["X", "INSTAGRAM"],
        isActive: true,
        scheduleCron: "0 9 * * *",
        autoPublish: true,
        maxPerDay: 5,
        config: {},
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        profile: { id: "profile-1", name: "Test Profile" },
      };

      (prisma.agent.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

      const result = await agentRepo.findById("agent-1");

      expect(prisma.agent.findUnique).toHaveBeenCalledWith({
        where: { id: "agent-1" },
        include: { profile: { select: { id: true, name: true } } },
      });
      expect(result).toEqual(mockAgent);
      expect(result?.profile.name).toBe("Test Profile");
    });

    it("should return null when agent not found", async () => {
      (prisma.agent.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await agentRepo.findById("nonexistent");

      expect(result).toBeNull();
    });

    it("should reject when prisma throws", async () => {
      (prisma.agent.findUnique as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(agentRepo.findById("agent-1")).rejects.toThrow("DB error");
    });
  });

  describe("findByProfileId", () => {
    it("should return agents ordered by createdAt desc", async () => {
      const mockAgents = [
        {
          id: "agent-2",
          profileId: "profile-1",
          name: "Agent B",
          platforms: ["X"],
          createdAt: new Date("2024-02-01"),
        },
        {
          id: "agent-1",
          profileId: "profile-1",
          name: "Agent A",
          platforms: ["INSTAGRAM"],
          createdAt: new Date("2024-01-01"),
        },
      ];

      (prisma.agent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgents);

      const result = await agentRepo.findByProfileId("profile-1");

      expect(prisma.agent.findMany).toHaveBeenCalledWith({
        where: { profileId: "profile-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("agent-2");
    });

    it("should return empty array when no agents found", async () => {
      (prisma.agent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await agentRepo.findByProfileId("profile-empty");

      expect(result).toStrictEqual([]);
    });

    it("should reject when prisma throws", async () => {
      (prisma.agent.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(agentRepo.findByProfileId("profile-1")).rejects.toThrow("DB error");
    });
  });

  describe("create", () => {
    const createInput = {
      profileId: "profile-1",
      name: "New Agent",
      type: "CONTENT_GENERATOR",
      platforms: ["X" as const, "INSTAGRAM" as const],
      scheduleCron: "0 9 * * *",
      autoPublish: true,
      maxPerDay: 5,
      config: { tone: "professional" },
    };

    it("should create agent with all fields mapped", async () => {
      const mockCreated = {
        id: "agent-new",
        ...createInput,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.agent.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreated);

      const result = await agentRepo.create(createInput);

      expect(prisma.agent.create).toHaveBeenCalledWith({
        data: {
          profileId: "profile-1",
          name: "New Agent",
          type: "CONTENT_GENERATOR",
          platforms: ["X", "INSTAGRAM"],
          scheduleCron: "0 9 * * *",
          autoPublish: true,
          maxPerDay: 5,
          config: { tone: "professional" },
        },
      });
      expect(result).toEqual(mockCreated);
    });

    it("should apply defaults for null/missing fields", async () => {
      const minimalInput = {
        profileId: "profile-1",
        name: "Minimal Agent",
        type: "SCHEDULER",
        platforms: ["X" as const],
      };

      (prisma.agent.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "agent-min",
        profileId: "profile-1",
        name: "Minimal Agent",
        type: "SCHEDULER",
        platforms: ["X"],
        scheduleCron: null,
        autoPublish: false,
        maxPerDay: 2,
        config: {},
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await agentRepo.create(minimalInput);

      expect(prisma.agent.create).toHaveBeenCalledWith({
        data: {
          profileId: "profile-1",
          name: "Minimal Agent",
          type: "SCHEDULER",
          platforms: ["X"],
          scheduleCron: null,
          autoPublish: false,
          maxPerDay: 2,
          config: {},
        },
      });
    });

    it("should reject when prisma throws", async () => {
      (prisma.agent.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(agentRepo.create(createInput)).rejects.toThrow("DB error");
    });
  });

  describe("update", () => {
    it("should update agent and return updated record", async () => {
      const updateData = { name: "Updated Name", isActive: false };
      const mockUpdated = {
        id: "agent-1",
        profileId: "profile-1",
        name: "Updated Name",
        type: "CONTENT_GENERATOR",
        platforms: ["X"],
        isActive: false,
        scheduleCron: null,
        autoPublish: false,
        maxPerDay: 2,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.agent.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdated);

      const result = await agentRepo.update("agent-1", updateData);

      expect(prisma.agent.update).toHaveBeenCalledWith({
        where: { id: "agent-1" },
        data: updateData,
      });
      expect(result.name).toBe("Updated Name");
      expect(result.isActive).toBe(false);
    });

    it("should reject when prisma throws", async () => {
      (prisma.agent.update as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Not found"),
      );

      await expect(agentRepo.update("nonexistent", { name: "X" })).rejects.toThrow("Not found");
    });
  });

  describe("delete", () => {
    it("should delete agent by id", async () => {
      (prisma.agent.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({} as any);

      await agentRepo.delete("agent-1");

      expect(prisma.agent.delete).toHaveBeenCalledWith({ where: { id: "agent-1" } });
    });

    it("should reject when prisma throws", async () => {
      (prisma.agent.delete as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Not found"),
      );

      await expect(agentRepo.delete("nonexistent")).rejects.toThrow("Not found");
    });
  });

  describe("findActiveByPlatform", () => {
    it("should return active agents for platform with profile included", async () => {
      const mockAgents = [
        {
          id: "agent-1",
          profileId: "profile-1",
          name: "X Agent",
          type: "CONTENT_GENERATOR",
          platforms: ["X"],
          isActive: true,
          scheduleCron: null,
          autoPublish: false,
          maxPerDay: 2,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          profile: { id: "profile-1", name: "Test Profile", userId: "user-1" },
        },
      ];

      (prisma.agent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgents);

      const result = await agentRepo.findActiveByPlatform("X" as any);

      expect(prisma.agent.findMany).toHaveBeenCalledWith({
        where: { isActive: true, platforms: { has: "X" } },
        include: { profile: { select: { id: true, name: true, userId: true } } },
      });
      expect(result).toHaveLength(1);
      expect((result[0] as any).profile.userId).toBe("user-1");
    });

    it("should reject when prisma throws", async () => {
      (prisma.agent.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(agentRepo.findActiveByPlatform("X" as any)).rejects.toThrow("DB error");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PrismaAgentRunRepository
// ═════════════════════════════════════════════════════════════════════════════

describe("PrismaAgentRunRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("should return run with generatedContents when found", async () => {
      const mockRun = {
        id: "run-1",
        agentId: "agent-1",
        brief: "Generate posts",
        status: "SUCCESS",
        error: null,
        startedAt: new Date(),
        finishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        generatedContents: [
          { id: "c-1", platform: "X", status: "PUBLISHED" },
          { id: "c-2", platform: "INSTAGRAM", status: "DRAFT" },
        ],
      };

      (prisma.agentRun.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockRun,
      );

      const result = await runRepo.findById("run-1");

      expect(prisma.agentRun.findUnique).toHaveBeenCalledWith({
        where: { id: "run-1" },
        include: {
          generatedContents: {
            select: { id: true, platform: true, status: true },
          },
        },
      });
      expect(result).toEqual(mockRun);
    });

    it("should return null when run not found", async () => {
      (prisma.agentRun.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await runRepo.findById("nonexistent");

      expect(result).toBeNull();
    });

    it("should reject when prisma throws", async () => {
      (prisma.agentRun.findUnique as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(runRepo.findById("run-1")).rejects.toThrow("DB error");
    });
  });

  describe("findByAgentId", () => {
    it("should return runs ordered by createdAt desc", async () => {
      const mockRuns = [
        { id: "run-2", agentId: "agent-1", status: "SUCCESS", createdAt: new Date("2024-02-01") },
        { id: "run-1", agentId: "agent-1", status: "FAILED", createdAt: new Date("2024-01-01") },
      ];

      (prisma.agentRun.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockRuns);

      const result = await runRepo.findByAgentId("agent-1");

      expect(prisma.agentRun.findMany).toHaveBeenCalledWith({
        where: { agentId: "agent-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("run-2");
    });

    it("should return empty array when agent has no runs", async () => {
      (prisma.agentRun.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await runRepo.findByAgentId("agent-empty");

      expect(result).toStrictEqual([]);
    });

    it("should reject when prisma throws", async () => {
      (prisma.agentRun.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(runRepo.findByAgentId("agent-1")).rejects.toThrow("DB error");
    });
  });

  describe("create", () => {
    it("should create agent run with agentId and brief", async () => {
      const mockCreated = {
        id: "run-new",
        agentId: "agent-1",
        brief: "Generate content",
        status: "PENDING",
        error: null,
        startedAt: null,
        finishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.agentRun.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockCreated,
      );

      const result = await runRepo.create({ agentId: "agent-1", brief: "Generate content" });

      expect(prisma.agentRun.create).toHaveBeenCalledWith({
        data: { agentId: "agent-1", brief: "Generate content" },
      });
      expect(result).toEqual(mockCreated);
    });

    it("should reject when prisma throws", async () => {
      (prisma.agentRun.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      await expect(runRepo.create({ agentId: "agent-1", brief: "fail" })).rejects.toThrow(
        "DB error",
      );
    });
  });

  describe("updateStatus", () => {
    it("should set startedAt when status is RUNNING", async () => {
      const mockUpdated = {
        id: "run-1",
        agentId: "agent-1",
        status: "RUNNING",
        startedAt: new Date(),
        finishedAt: null,
      } as any;

      (prisma.agentRun.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockUpdated,
      );

      const result = await runRepo.updateStatus("run-1", "RUNNING");

      expect(prisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-1" },
        data: expect.objectContaining({
          status: "RUNNING",
          startedAt: expect.any(Date),
        }),
      });
      expect(result.status).toBe("RUNNING");
    });

    it("should set finishedAt when status is SUCCESS", async () => {
      (prisma.agentRun.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "run-1",
        status: "SUCCESS",
        finishedAt: new Date(),
      });

      await runRepo.updateStatus("run-1", "SUCCESS");

      expect(prisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-1" },
        data: expect.objectContaining({
          status: "SUCCESS",
          finishedAt: expect.any(Date),
        }),
      });
    });

    it("should set finishedAt when status is FAILED", async () => {
      (prisma.agentRun.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "run-1",
        status: "FAILED",
        finishedAt: new Date(),
      });

      await runRepo.updateStatus("run-1", "FAILED");

      expect(prisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-1" },
        data: expect.objectContaining({
          status: "FAILED",
          finishedAt: expect.any(Date),
        }),
      });
    });

    it("should set finishedAt when status is CANCELLED", async () => {
      (prisma.agentRun.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "run-1",
        status: "CANCELLED",
        finishedAt: new Date(),
      });

      await runRepo.updateStatus("run-1", "CANCELLED");

      expect(prisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-1" },
        data: expect.objectContaining({
          status: "CANCELLED",
          finishedAt: expect.any(Date),
        }),
      });
    });

    it("should attach error message when provided", async () => {
      (prisma.agentRun.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "run-1",
        status: "FAILED",
        error: "Something went wrong",
        finishedAt: new Date(),
      });

      await runRepo.updateStatus("run-1", "FAILED", "Something went wrong");

      expect(prisma.agentRun.update).toHaveBeenCalledWith({
        where: { id: "run-1" },
        data: expect.objectContaining({
          status: "FAILED",
          error: "Something went wrong",
          finishedAt: expect.any(Date),
        }),
      });
    });

    it("should not set error when not provided", async () => {
      (prisma.agentRun.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "run-1",
        status: "SUCCESS",
      });

      await runRepo.updateStatus("run-1", "SUCCESS");

      // The update data should NOT contain error field
      const callArg = (prisma.agentRun.update as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(callArg.data).not.toHaveProperty("error");
    });

    it("should reject when prisma throws", async () => {
      (prisma.agentRun.update as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Not found"),
      );

      await expect(runRepo.updateStatus("nonexistent", "RUNNING")).rejects.toThrow("Not found");
    });
  });
});
