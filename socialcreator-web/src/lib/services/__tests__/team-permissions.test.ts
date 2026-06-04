/**
 * Tests for team permissions service (team-permissions.ts)
 *
 * Covers checkTeamAccess, canModifyMemberRole, canRemoveMember,
 * canDeleteTeam, canEditProfile, and getUserTeamRole.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    teamMember: {
      findFirst: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
    profile: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Team permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkTeamAccess", () => {
    it("should be a function", async () => {
      const { checkTeamAccess } = await import("@/lib/services/team-permissions");
      expect(typeof checkTeamAccess).toBe("function");
    });

    it("should return can=true when user is a member", async () => {
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: "membership-1",
        role: "MEMBER",
      } as any);

      const { checkTeamAccess } = await import("@/lib/services/team-permissions");
      const result = await checkTeamAccess("user-1", "team-1");

      expect(result).toEqual({ can: true });
    });

    it("should return can=true when user is the team owner even without membership", async () => {
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "user-1",
      } as any);

      const { checkTeamAccess } = await import("@/lib/services/team-permissions");
      const result = await checkTeamAccess("user-1", "team-1");

      expect(result).toEqual({ can: true });
    });

    it("should return can=false with reason when team does not exist", async () => {
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      const { checkTeamAccess } = await import("@/lib/services/team-permissions");
      const result = await checkTeamAccess("user-1", "nonexistent-team");

      expect(result).toEqual({ can: false, reason: "Team not found" });
    });

    it("should return can=false when user is not a member and not owner", async () => {
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);

      const { checkTeamAccess } = await import("@/lib/services/team-permissions");
      const result = await checkTeamAccess("user-1", "team-1");

      expect(result).toEqual({
        can: false,
        reason: "You are not a member of this team",
      });
    });
  });

  describe("canModifyMemberRole", () => {
    it("should be a function", async () => {
      const { canModifyMemberRole } = await import("@/lib/services/team-permissions");
      expect(typeof canModifyMemberRole).toBe("function");
    });

    it("should return can=true for the team owner targeting another member", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);

      const { canModifyMemberRole } = await import("@/lib/services/team-permissions");
      const result = await canModifyMemberRole("owner-1", "team-1", "member-1");

      expect(result).toEqual({ can: true });
    });

    it("should return can=false when team does not exist", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      const { canModifyMemberRole } = await import("@/lib/services/team-permissions");
      const result = await canModifyMemberRole("user-1", "nonexistent", "member-1");

      expect(result).toEqual({ can: false, reason: "Team not found" });
    });

    it("should return can=false when user is not the owner", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);

      const { canModifyMemberRole } = await import("@/lib/services/team-permissions");
      const result = await canModifyMemberRole("user-1", "team-1", "member-1");

      expect(result).toEqual({
        can: false,
        reason: "Only the team owner can modify member roles",
      });
    });

    it("should return can=false when trying to modify own role", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);

      const { canModifyMemberRole } = await import("@/lib/services/team-permissions");
      const result = await canModifyMemberRole("owner-1", "team-1", "owner-1");

      expect(result).toEqual({
        can: false,
        reason: "Cannot modify your own role",
      });
    });
  });

  describe("canRemoveMember", () => {
    it("should be a function", async () => {
      const { canRemoveMember } = await import("@/lib/services/team-permissions");
      expect(typeof canRemoveMember).toBe("function");
    });

    it("should return can=true when owner removes another member", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);

      const { canRemoveMember } = await import("@/lib/services/team-permissions");
      const result = await canRemoveMember("owner-1", "team-1", "member-1");

      expect(result).toEqual({ can: true });
    });

    it("should return can=false when owner tries to remove themselves", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);

      const { canRemoveMember } = await import("@/lib/services/team-permissions");
      const result = await canRemoveMember("owner-1", "team-1", "owner-1");

      expect(result).toEqual({
        can: false,
        reason: "Cannot remove yourself from the team",
      });
    });

    it("should return can=false when team does not exist", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      const { canRemoveMember } = await import("@/lib/services/team-permissions");
      const result = await canRemoveMember("user-1", "nonexistent", "member-1");

      expect(result).toEqual({ can: false, reason: "Team not found" });
    });

    it("should return can=true when admin removes a member (not owner)", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: "admin-membership",
        role: "ADMIN",
      } as any);

      const { canRemoveMember } = await import("@/lib/services/team-permissions");
      const result = await canRemoveMember("admin-1", "team-1", "member-1");

      expect(result).toEqual({ can: true });
    });

    it("should return can=false when admin tries to remove the owner", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: "admin-membership",
        role: "ADMIN",
      } as any);

      const { canRemoveMember } = await import("@/lib/services/team-permissions");
      const result = await canRemoveMember("admin-1", "team-1", "owner-1");

      expect(result).toEqual({
        can: false,
        reason: "Cannot remove the team owner",
      });
    });

    it("should return can=false when a non-admin tries to remove", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: "viewer-membership",
        role: "VIEWER",
      } as any);

      const { canRemoveMember } = await import("@/lib/services/team-permissions");
      const result = await canRemoveMember("viewer-1", "team-1", "member-1");

      expect(result).toEqual({
        can: false,
        reason: "Only team owner or admins can remove members",
      });
    });

    it("should return can=false when user has no membership record", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);

      const { canRemoveMember } = await import("@/lib/services/team-permissions");
      const result = await canRemoveMember("non-member", "team-1", "member-1");

      expect(result).toEqual({
        can: false,
        reason: "Only team owner or admins can remove members",
      });
    });
  });

  describe("canDeleteTeam", () => {
    it("should be a function", async () => {
      const { canDeleteTeam } = await import("@/lib/services/team-permissions");
      expect(typeof canDeleteTeam).toBe("function");
    });

    it("should return can=true when owner deletes team with no active profiles", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);
      vi.mocked(prisma.profile.count).mockResolvedValue(0);

      const { canDeleteTeam } = await import("@/lib/services/team-permissions");
      const result = await canDeleteTeam("owner-1", "team-1");

      expect(result).toEqual({ can: true });
    });

    it("should return can=false when team does not exist", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      const { canDeleteTeam } = await import("@/lib/services/team-permissions");
      const result = await canDeleteTeam("user-1", "nonexistent");

      expect(result).toEqual({ can: false, reason: "Team not found" });
    });

    it("should return can=false when non-owner tries to delete", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);

      const { canDeleteTeam } = await import("@/lib/services/team-permissions");
      const result = await canDeleteTeam("user-1", "team-1");

      expect(result).toEqual({
        can: false,
        reason: "Only the team owner can delete the team",
      });
    });

    it("should return can=false when team has active profiles", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);
      vi.mocked(prisma.profile.count).mockResolvedValue(3);

      const { canDeleteTeam } = await import("@/lib/services/team-permissions");
      const result = await canDeleteTeam("owner-1", "team-1");

      expect(result).toEqual({
        can: false,
        reason:
          "Cannot delete team with 3 active profile(s). Transfer or deactivate profiles first.",
      });
    });
  });

  describe("canEditProfile", () => {
    it("should be a function", async () => {
      const { canEditProfile } = await import("@/lib/services/team-permissions");
      expect(typeof canEditProfile).toBe("function");
    });

    it("should return can=true when user is the profile owner", async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue({
        teamId: null,
        userId: "user-1",
      } as any);

      const { canEditProfile } = await import("@/lib/services/team-permissions");
      const result = await canEditProfile("user-1", "profile-1");

      expect(result).toEqual({ can: true });
    });

    it("should return can=false when profile does not exist", async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);

      const { canEditProfile } = await import("@/lib/services/team-permissions");
      const result = await canEditProfile("user-1", "nonexistent");

      expect(result).toEqual({ can: false, reason: "Profile not found" });
    });

    it("should return can=true when user is a team member with edit role", async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue({
        teamId: "team-1",
        userId: "owner-1",
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: "membership-1",
        role: "MEMBER",
      } as any);

      const { canEditProfile } = await import("@/lib/services/team-permissions");
      const result = await canEditProfile("member-1", "profile-1");

      expect(result).toEqual({ can: true });
    });

    it("should return can=false when user is a VIEWER on the team", async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue({
        teamId: "team-1",
        userId: "owner-1",
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: "membership-1",
        role: "VIEWER",
      } as any);

      const { canEditProfile } = await import("@/lib/services/team-permissions");
      const result = await canEditProfile("viewer-1", "profile-1");

      expect(result).toEqual({
        can: false,
        reason: "Viewers cannot edit profiles",
      });
    });

    it("should return can=false when user is not on the team", async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue({
        teamId: "team-1",
        userId: "owner-1",
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);

      const { canEditProfile } = await import("@/lib/services/team-permissions");
      const result = await canEditProfile("non-member", "profile-1");

      expect(result).toEqual({
        can: false,
        reason: "You don't have access to this profile",
      });
    });

    it("should return can=false when profile is not owned by user and has no team", async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue({
        teamId: null,
        userId: "owner-1",
      } as any);

      const { canEditProfile } = await import("@/lib/services/team-permissions");
      const result = await canEditProfile("other-user", "profile-1");

      expect(result).toEqual({
        can: false,
        reason: "You don't have access to this profile",
      });
    });

    it("should return can=true when user is admin on the team", async () => {
      vi.mocked(prisma.profile.findUnique).mockResolvedValue({
        teamId: "team-1",
        userId: "owner-1",
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: "membership-1",
        role: "ADMIN",
      } as any);

      const { canEditProfile } = await import("@/lib/services/team-permissions");
      const result = await canEditProfile("admin-1", "profile-1");

      expect(result).toEqual({ can: true });
    });
  });

  describe("getUserTeamRole", () => {
    it("should be a function", async () => {
      const { getUserTeamRole } = await import("@/lib/services/team-permissions");
      expect(typeof getUserTeamRole).toBe("function");
    });

    it("should return OWNER for the team owner", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "user-1",
      } as any);

      const { getUserTeamRole } = await import("@/lib/services/team-permissions");
      const role = await getUserTeamRole("user-1", "team-1");

      expect(role).toBe("OWNER");
    });

    it("should return the role for a team member", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        role: "ADMIN",
      } as any);

      const { getUserTeamRole } = await import("@/lib/services/team-permissions");
      const role = await getUserTeamRole("admin-1", "team-1");

      expect(role).toBe("ADMIN");
    });

    it("should return null for a non-member", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ownerId: "owner-1",
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);

      const { getUserTeamRole } = await import("@/lib/services/team-permissions");
      const role = await getUserTeamRole("non-member", "team-1");

      expect(role).toBeNull();
    });

    it("should return null when team does not exist", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      const { getUserTeamRole } = await import("@/lib/services/team-permissions");
      const role = await getUserTeamRole("user-1", "nonexistent");

      expect(role).toBeNull();
    });
  });
});
