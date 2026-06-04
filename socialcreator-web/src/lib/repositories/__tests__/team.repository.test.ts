import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for PrismaTeamRepository
 *
 * Verifies:
 * - findById(id) — success (with members+user include), null, rejection
 * - findByOwnerId(ownerId) — success, empty array, rejection
 * - create(data) — success, rejection
 * - update(id, data) — success, rejection
 * - delete(id) — success, rejection
 */

// ── Mock prisma ─────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    team: {
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
import { PrismaTeamRepository } from "@/lib/repositories/team.repository";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMockTeam(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-1",
    name: "My Team",
    ownerId: "user-1",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    members: [
      {
        id: "tm-1",
        userId: "user-1",
        role: "OWNER",
        user: { id: "user-1", name: "Test User", email: "test@example.com" },
      },
    ],
    ...overrides,
  };
}

// ── Repository Instance ─────────────────────────────────────────────────────

const repo = new PrismaTeamRepository();

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PrismaTeamRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("returns team with members and user include when found", async () => {
      const mockTeam = makeMockTeam({ id: "team-1" });
      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam);

      const result = await repo.findById("team-1");

      expect(result).toEqual(mockTeam);
      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: "team-1" },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });

    it("returns null when not found", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      const result = await repo.findById("nonexistent");

      expect(result).toBeNull();
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.team.findUnique).mockRejectedValue(new Error("DB error"));

      await expect(repo.findById("team-1")).rejects.toThrow("DB error");
    });
  });

  describe("findByOwnerId", () => {
    it("returns teams for owner ordered by createdAt desc", async () => {
      const teams = [
        makeMockTeam({ id: "team-1", name: "First Team" }),
        makeMockTeam({ id: "team-2", name: "Second Team" }),
      ];
      vi.mocked(prisma.team.findMany).mockResolvedValue(teams);

      const result = await repo.findByOwnerId("user-1");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("team-1");
      expect(prisma.team.findMany).toHaveBeenCalledWith({
        where: { ownerId: "user-1" },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns empty array when owner has no teams", async () => {
      vi.mocked(prisma.team.findMany).mockResolvedValue([]);

      const result = await repo.findByOwnerId("user-empty");

      expect(result).toStrictEqual([]);
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.team.findMany).mockRejectedValue(new Error("DB error"));

      await expect(repo.findByOwnerId("user-1")).rejects.toThrow("DB error");
    });
  });

  describe("create", () => {
    it("creates a team with name and ownerId", async () => {
      const input = { name: "New Team", ownerId: "user-1" };
      const mockTeam = makeMockTeam({ id: "team-new", name: "New Team", ownerId: "user-1" });
      vi.mocked(prisma.team.create).mockResolvedValue(mockTeam);

      const result = await repo.create(input);

      expect(result).toEqual(mockTeam);
      expect(prisma.team.create).toHaveBeenCalledWith({
        data: { name: "New Team", ownerId: "user-1" },
      });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.team.create).mockRejectedValue(new Error("DB error"));

      await expect(repo.create({ name: "Fail Team", ownerId: "user-1" })).rejects.toThrow(
        "DB error",
      );
    });
  });

  describe("update", () => {
    it("updates team name", async () => {
      const updateData = { name: "Updated Team Name" };
      const updatedTeam = makeMockTeam({ id: "team-1", name: "Updated Team Name" });
      vi.mocked(prisma.team.update).mockResolvedValue(updatedTeam);

      const result = await repo.update("team-1", updateData);

      expect(result).toEqual(updatedTeam);
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: "team-1" },
        data: updateData,
      });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.team.update).mockRejectedValue(new Error("DB error"));

      await expect(repo.update("team-1", { name: "Fail" })).rejects.toThrow("DB error");
    });
  });

  describe("delete", () => {
    it("deletes team by id", async () => {
      vi.mocked(prisma.team.delete).mockResolvedValue({} as any);

      await repo.delete("team-1");

      expect(prisma.team.delete).toHaveBeenCalledWith({ where: { id: "team-1" } });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.team.delete).mockRejectedValue(new Error("DB error"));

      await expect(repo.delete("nonexistent")).rejects.toThrow("DB error");
    });
  });
});
