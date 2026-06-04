import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for PrismaTeamMemberRepository
 *
 * Verifies:
 * - findById(id) — success, null, rejection
 * - findByTeamId(teamId) — with user include + order, rejection
 * - findByUserId(userId) — with team include + order, rejection
 * - addMember(teamId, userId, role?) — default role VIEWER, explicit role, rejection
 * - updateRole(id, role) — success, rejection
 * - removeMember(id) — success, rejection
 */

// ── Mock prisma ─────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    teamMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { PrismaTeamMemberRepository } from "@/lib/repositories/team-member.repository";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMockTeamMember(overrides: Record<string, unknown> = {}) {
  return {
    id: "tm-1",
    teamId: "team-1",
    userId: "user-1",
    role: "VIEWER",
    invitedAt: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// ── Repository Instance ─────────────────────────────────────────────────────

const repo = new PrismaTeamMemberRepository();

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PrismaTeamMemberRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("returns team member when found", async () => {
      const mockMember = makeMockTeamMember({ id: "tm-1" });
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(mockMember as any);

      const result = await repo.findById("tm-1");

      expect(result).toEqual(mockMember);
      expect(prisma.teamMember.findUnique).toHaveBeenCalledWith({ where: { id: "tm-1" } });
    });

    it("returns null when not found", async () => {
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as any);

      const result = await repo.findById("nonexistent");

      expect(result).toBeNull();
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.teamMember.findUnique).mockRejectedValue(new Error("DB error"));

      await expect(repo.findById("tm-1")).rejects.toThrow("DB error");
    });
  });

  describe("findByTeamId", () => {
    it("returns members with user include ordered by invitedAt desc", async () => {
      const members = [
        makeMockTeamMember({
          id: "tm-1",
          user: { id: "user-1", name: "Alice", email: "alice@example.com" },
        }),
        makeMockTeamMember({
          id: "tm-2",
          userId: "user-2",
          role: "EDITOR",
          user: { id: "user-2", name: "Bob", email: "bob@example.com" },
        }),
      ];
      vi.mocked(prisma.teamMember.findMany).mockResolvedValue(members as any);

      const result = await repo.findByTeamId("team-1");

      expect(result).toHaveLength(2);
      expect(prisma.teamMember.findMany).toHaveBeenCalledWith({
        where: { teamId: "team-1" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { invitedAt: "desc" },
      });
    });

    it("returns empty array when team has no members", async () => {
      vi.mocked(prisma.teamMember.findMany).mockResolvedValue([] as any);

      const result = await repo.findByTeamId("team-empty");

      expect(result).toStrictEqual([]);
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.teamMember.findMany).mockRejectedValue(new Error("DB error"));

      await expect(repo.findByTeamId("team-1")).rejects.toThrow("DB error");
    });
  });

  describe("findByUserId", () => {
    it("returns memberships with team include ordered by invitedAt desc", async () => {
      const memberships = [
        makeMockTeamMember({
          id: "tm-1",
          team: { id: "team-1", name: "Alpha" },
        }),
        makeMockTeamMember({
          id: "tm-2",
          teamId: "team-2",
          team: { id: "team-2", name: "Beta" },
        }),
      ];
      vi.mocked(prisma.teamMember.findMany).mockResolvedValue(memberships as any);

      const result = await repo.findByUserId("user-1");

      expect(result).toHaveLength(2);
      expect(prisma.teamMember.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        include: {
          team: { select: { id: true, name: true } },
        },
        orderBy: { invitedAt: "desc" },
      });
    });

    it("returns empty array when user has no memberships", async () => {
      vi.mocked(prisma.teamMember.findMany).mockResolvedValue([] as any);

      const result = await repo.findByUserId("user-empty");

      expect(result).toStrictEqual([]);
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.teamMember.findMany).mockRejectedValue(new Error("DB error"));

      await expect(repo.findByUserId("user-1")).rejects.toThrow("DB error");
    });
  });

  describe("addMember", () => {
    it("adds a member with default role VIEWER", async () => {
      const member = makeMockTeamMember({
        id: "tm-new",
        teamId: "team-1",
        userId: "user-2",
        role: "VIEWER",
      });
      vi.mocked(prisma.teamMember.create).mockResolvedValue(member as any);

      const result = await repo.addMember({ teamId: "team-1", userId: "user-2" });

      expect(result).toEqual(member);
      expect(prisma.teamMember.create).toHaveBeenCalledWith({
        data: { teamId: "team-1", userId: "user-2", role: "VIEWER" },
      });
    });

    it("adds a member with explicit role", async () => {
      const member = makeMockTeamMember({
        id: "tm-new",
        teamId: "team-1",
        userId: "user-3",
        role: "EDITOR",
      });
      vi.mocked(prisma.teamMember.create).mockResolvedValue(member as any);

      const result = await repo.addMember({ teamId: "team-1", userId: "user-3", role: "EDITOR" });

      expect(result).toEqual(member);
      expect(prisma.teamMember.create).toHaveBeenCalledWith({
        data: { teamId: "team-1", userId: "user-3", role: "EDITOR" },
      });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.teamMember.create).mockRejectedValue(new Error("DB error"));

      await expect(repo.addMember({ teamId: "team-1", userId: "user-x" })).rejects.toThrow(
        "DB error",
      );
    });
  });

  describe("updateRole", () => {
    it("updates member role", async () => {
      const updatedMember = makeMockTeamMember({
        id: "tm-1",
        role: "ADMIN",
      });
      vi.mocked(prisma.teamMember.update).mockResolvedValue(updatedMember as any);

      const result = await repo.updateRole("tm-1", "ADMIN");

      expect(result).toEqual(updatedMember);
      expect(prisma.teamMember.update).toHaveBeenCalledWith({
        where: { id: "tm-1" },
        data: { role: "ADMIN" },
      });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.teamMember.update).mockRejectedValue(new Error("DB error"));

      await expect(repo.updateRole("tm-1", "ADMIN")).rejects.toThrow("DB error");
    });
  });

  describe("removeMember", () => {
    it("removes member by id", async () => {
      vi.mocked(prisma.teamMember.delete).mockResolvedValue({} as any);

      await repo.removeMember("tm-1");

      expect(prisma.teamMember.delete).toHaveBeenCalledWith({ where: { id: "tm-1" } });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.teamMember.delete).mockRejectedValue(new Error("DB error"));

      await expect(repo.removeMember("nonexistent")).rejects.toThrow("DB error");
    });
  });
});
