import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for PrismaInvitationRepository
 *
 * Verifies:
 * - findById(id) — success, null, rejection
 * - findByToken(token) — success, null, rejection
 * - findByTeamId(teamId) — success, empty, rejection
 * - findByEmail(email) — success, empty, rejection
 * - findPendingByEmail(email) — compound WHERE (status + expiresAt), rejection
 * - findPendingByTeamIdAndEmail(teamId, email) — success, null, rejection
 * - create(data) — success, rejection
 * - updateStatus(id, status) — conditional timestamps for ACCEPTED/REJECTED, rejection
 */

// ── Mock prisma ─────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invitation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { PrismaInvitationRepository } from "@/lib/repositories/invitation.repository";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMockInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    teamId: "team-1",
    invitedByUserId: "user-1",
    email: "invited@example.com",
    role: "VIEWER",
    token: "token-abc-123",
    status: "PENDING",
    expiresAt: new Date("2025-12-31"),
    acceptedAt: null,
    rejectedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// ── Repository Instance ─────────────────────────────────────────────────────

const repo = new PrismaInvitationRepository();

// ── Tests ───────────────────────────────────────────────────────────────────

describe("PrismaInvitationRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("returns invitation when found", async () => {
      const mockInvitation = makeMockInvitation({ id: "inv-1" });
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(mockInvitation as any);

      const result = await repo.findById("inv-1");

      expect(result).toEqual(mockInvitation);
      expect(prisma.invitation.findUnique).toHaveBeenCalledWith({ where: { id: "inv-1" } });
    });

    it("returns null when not found", async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null as any);

      const result = await repo.findById("nonexistent");

      expect(result).toBeNull();
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.invitation.findUnique).mockRejectedValue(new Error("DB error"));

      await expect(repo.findById("inv-1")).rejects.toThrow("DB error");
    });
  });

  describe("findByToken", () => {
    it("returns invitation when token matches", async () => {
      const mockInvitation = makeMockInvitation({ token: "token-abc-123" });
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(mockInvitation as any);

      const result = await repo.findByToken("token-abc-123");

      expect(result).toEqual(mockInvitation);
      expect(prisma.invitation.findUnique).toHaveBeenCalledWith({
        where: { token: "token-abc-123" },
      });
    });

    it("returns null when token does not match", async () => {
      vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null as any);

      const result = await repo.findByToken("invalid-token");

      expect(result).toBeNull();
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.invitation.findUnique).mockRejectedValue(new Error("DB error"));

      await expect(repo.findByToken("token")).rejects.toThrow("DB error");
    });
  });

  describe("findByTeamId", () => {
    it("returns invitations for a team ordered by createdAt desc", async () => {
      const invitations = [
        makeMockInvitation({ id: "inv-1", email: "a@example.com" }),
        makeMockInvitation({ id: "inv-2", email: "b@example.com" }),
      ];
      vi.mocked(prisma.invitation.findMany).mockResolvedValue(invitations as any);

      const result = await repo.findByTeamId("team-1");

      expect(result).toHaveLength(2);
      expect(prisma.invitation.findMany).toHaveBeenCalledWith({
        where: { teamId: "team-1" },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns empty array when team has no invitations", async () => {
      vi.mocked(prisma.invitation.findMany).mockResolvedValue([] as any);

      const result = await repo.findByTeamId("team-empty");

      expect(result).toStrictEqual([]);
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.invitation.findMany).mockRejectedValue(new Error("DB error"));

      await expect(repo.findByTeamId("team-1")).rejects.toThrow("DB error");
    });
  });

  describe("findByEmail", () => {
    it("returns invitations for an email ordered by createdAt desc", async () => {
      const invitations = [
        makeMockInvitation({ id: "inv-1", email: "test@example.com" }),
        makeMockInvitation({ id: "inv-2", email: "test@example.com" }),
      ];
      vi.mocked(prisma.invitation.findMany).mockResolvedValue(invitations as any);

      const result = await repo.findByEmail("test@example.com");

      expect(result).toHaveLength(2);
      expect(prisma.invitation.findMany).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns empty array when email has no invitations", async () => {
      vi.mocked(prisma.invitation.findMany).mockResolvedValue([] as any);

      const result = await repo.findByEmail("unknown@example.com");

      expect(result).toStrictEqual([]);
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.invitation.findMany).mockRejectedValue(new Error("DB error"));

      await expect(repo.findByEmail("test@example.com")).rejects.toThrow("DB error");
    });
  });

  describe("findPendingByEmail", () => {
    it("returns pending invitations with status PENDING and not expired, with includes", async () => {
      const invitations = [
        {
          ...makeMockInvitation({
            id: "inv-1",
            email: "pending@example.com",
            status: "PENDING",
          }),
          team: { id: "team-1", name: "My Team" },
          invitedBy: { id: "user-1", name: "Inviter", email: "inviter@example.com" },
        },
      ];
      vi.mocked(prisma.invitation.findMany).mockResolvedValue(invitations as any);

      const result = await repo.findPendingByEmail("pending@example.com");

      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe("PENDING");
      expect((result[0] as any).team.name).toBe("My Team");
      expect((result[0] as any).invitedBy.name).toBe("Inviter");
      expect(prisma.invitation.findMany).toHaveBeenCalledWith({
        where: {
          email: "pending@example.com",
          status: "PENDING",
          expiresAt: { gte: expect.any(Date) },
        },
        include: {
          team: { select: { id: true, name: true } },
          invitedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("returns empty array when no pending invitations", async () => {
      vi.mocked(prisma.invitation.findMany).mockResolvedValue([] as any);

      const result = await repo.findPendingByEmail("no-pending@example.com");

      expect(result).toStrictEqual([]);
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.invitation.findMany).mockRejectedValue(new Error("DB error"));

      await expect(repo.findPendingByEmail("test@example.com")).rejects.toThrow("DB error");
    });
  });

  describe("findPendingByTeamIdAndEmail", () => {
    it("returns pending invitation when found", async () => {
      const mockInvitation = makeMockInvitation({
        id: "inv-1",
        teamId: "team-1",
        email: "user@example.com",
        status: "PENDING",
      });
      vi.mocked(prisma.invitation.findFirst).mockResolvedValue(mockInvitation as any);

      const result = await repo.findPendingByTeamIdAndEmail("team-1", "user@example.com");

      expect(result).toEqual(mockInvitation);
      expect(prisma.invitation.findFirst).toHaveBeenCalledWith({
        where: {
          teamId: "team-1",
          email: "user@example.com",
          status: "PENDING",
          expiresAt: { gte: expect.any(Date) },
        },
      });
    });

    it("returns null when no pending invitation matches", async () => {
      vi.mocked(prisma.invitation.findFirst).mockResolvedValue(null as any);

      const result = await repo.findPendingByTeamIdAndEmail("team-1", "unknown@example.com");

      expect(result).toBeNull();
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.invitation.findFirst).mockRejectedValue(new Error("DB error"));

      await expect(repo.findPendingByTeamIdAndEmail("team-1", "test@example.com")).rejects.toThrow(
        "DB error",
      );
    });
  });

  describe("create", () => {
    it("creates an invitation with all fields", async () => {
      const input = {
        teamId: "team-1",
        invitedByUserId: "user-1",
        email: "newmember@example.com",
        role: "EDITOR" as const,
        token: "token-new-123",
        expiresAt: new Date("2025-12-31"),
      };
      const mockInvitation = makeMockInvitation({
        id: "inv-new",
        ...input,
      });
      vi.mocked(prisma.invitation.create).mockResolvedValue(mockInvitation as any);

      const result = await repo.create(input);

      expect(result).toEqual(mockInvitation);
      expect(prisma.invitation.create).toHaveBeenCalledWith({ data: input });
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.invitation.create).mockRejectedValue(new Error("DB error"));

      await expect(
        repo.create({
          teamId: "t1",
          invitedByUserId: "u1",
          email: "fail@example.com",
          role: "VIEWER" as const,
          token: "tok-fail",
          expiresAt: new Date(),
        }),
      ).rejects.toThrow("DB error");
    });
  });

  describe("updateStatus", () => {
    it("sets acceptedAt when accepting", async () => {
      const before = new Date();
      const updatedInvitation = makeMockInvitation({
        id: "inv-1",
        status: "ACCEPTED",
        acceptedAt: new Date(),
      });
      vi.mocked(prisma.invitation.update).mockResolvedValue(updatedInvitation as any);

      const result = await repo.updateStatus("inv-1", "ACCEPTED");

      expect(result.status).toBe("ACCEPTED");
      expect(result.acceptedAt).toBeInstanceOf(Date);
      const callArgs = vi.mocked(prisma.invitation.update).mock.calls[0]![0];
      expect(callArgs.where).toEqual({ id: "inv-1" });
      expect(callArgs.data.status).toBe("ACCEPTED");
      expect(callArgs.data.acceptedAt).toBeInstanceOf(Date);
      const calledAt = new Date((callArgs as any).data.acceptedAt);
      expect(calledAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(callArgs.data.rejectedAt).toBeUndefined();
    });

    it("sets rejectedAt when rejecting", async () => {
      const before = new Date();
      const updatedInvitation = makeMockInvitation({
        id: "inv-1",
        status: "REJECTED",
        rejectedAt: new Date(),
      });
      vi.mocked(prisma.invitation.update).mockResolvedValue(updatedInvitation as any);

      const result = await repo.updateStatus("inv-1", "REJECTED");

      expect(result.status).toBe("REJECTED");
      expect(result.rejectedAt).toBeInstanceOf(Date);
      const callArgs = vi.mocked(prisma.invitation.update).mock.calls[0]![0];
      expect(callArgs.where).toEqual({ id: "inv-1" });
      expect(callArgs.data.status).toBe("REJECTED");
      expect(callArgs.data.rejectedAt).toBeInstanceOf(Date);
      const calledAt = new Date((callArgs as any).data.rejectedAt);
      expect(calledAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(callArgs.data.acceptedAt).toBeUndefined();
    });

    it("does not set acceptedAt or rejectedAt for non-terminal statuses", async () => {
      const updatedInvitation = makeMockInvitation({
        id: "inv-1",
        status: "PENDING",
      });
      vi.mocked(prisma.invitation.update).mockResolvedValue(updatedInvitation as any);

      await repo.updateStatus("inv-1", "PENDING");

      const callArgs = vi.mocked(prisma.invitation.update).mock.calls[0]![0];
      expect(callArgs.data.status).toBe("PENDING");
      expect(callArgs.data.acceptedAt).toBeUndefined();
      expect(callArgs.data.rejectedAt).toBeUndefined();
    });

    it("handles prisma rejection", async () => {
      vi.mocked(prisma.invitation.update).mockRejectedValue(new Error("DB error"));

      await expect(repo.updateStatus("inv-1", "ACCEPTED")).rejects.toThrow("DB error");
    });
  });
});
