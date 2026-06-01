/**
 * Team Permissions Middleware
 * Checks user permissions for actions on teams and profiles
 */

import type { TeamRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface PermissionCheck {
  can: boolean;
  reason?: string;
}

/**
 * Check if a user can access a team
 */
export async function checkTeamAccess(userId: string, teamId: string): Promise<PermissionCheck> {
  const membership = await prisma.teamMember.findFirst({
    where: {
      teamId,
      userId,
    },
  });

  if (!membership) {
    // Check if user is owner
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { ownerId: true },
    });

    if (!team) {
      return { can: false, reason: "Team not found" };
    }

    if (team.ownerId !== userId) {
      return { can: false, reason: "You are not a member of this team" };
    }
  }

  return { can: true };
}

/**
 * Check if a user can modify a member's role
 * Only the OWNER can modify roles
 */
export async function canModifyMemberRole(
  userId: string,
  teamId: string,
  targetMemberId: string,
): Promise<PermissionCheck> {
  // Check if user is owner
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true },
  });

  if (!team) {
    return { can: false, reason: "Team not found" };
  }

  if (team.ownerId !== userId) {
    return { can: false, reason: "Only the team owner can modify member roles" };
  }

  // Cannot modify own role
  if (targetMemberId === userId) {
    return { can: false, reason: "Cannot modify your own role" };
  }

  return { can: true };
}

/**
 * Check if a user can remove a member
 * OWNER and ADMIN can remove members
 */
export async function canRemoveMember(
  userId: string,
  teamId: string,
  targetMemberId: string,
): Promise<PermissionCheck> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true },
  });

  if (!team) {
    return { can: false, reason: "Team not found" };
  }

  // Owner can remove anyone
  if (team.ownerId === userId) {
    // Cannot remove yourself
    if (targetMemberId === userId) {
      return { can: false, reason: "Cannot remove yourself from the team" };
    }
    return { can: true };
  }

  // Check if user is admin
  const userMembership = await prisma.teamMember.findFirst({
    where: {
      teamId,
      userId,
    },
  });

  if (!userMembership || userMembership.role !== "ADMIN") {
    return { can: false, reason: "Only team owner or admins can remove members" };
  }

  // Cannot remove owner
  if (targetMemberId === team.ownerId) {
    return { can: false, reason: "Cannot remove the team owner" };
  }

  return { can: true };
}

/**
 * Check if a user can delete the team
 * Only the OWNER can delete
 */
export async function canDeleteTeam(userId: string, teamId: string): Promise<PermissionCheck> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true },
  });

  if (!team) {
    return { can: false, reason: "Team not found" };
  }

  if (team.ownerId !== userId) {
    return { can: false, reason: "Only the team owner can delete the team" };
  }

  // Check if team has active profiles
  const activeProfiles = await prisma.profile.count({
    where: {
      teamId,
      isActive: true,
    },
  });

  if (activeProfiles > 0) {
    return {
      can: false,
      reason: `Cannot delete team with ${activeProfiles} active profile(s). Transfer or deactivate profiles first.`,
    };
  }

  return { can: true };
}

/**
 * Check if a user can edit a shared profile
 */
export async function canEditProfile(userId: string, profileId: string): Promise<PermissionCheck> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      teamId: true,
      userId: true,
    },
  });

  if (!profile) {
    return { can: false, reason: "Profile not found" };
  }

  // Owner can always edit
  if (profile.userId === userId) {
    return { can: true };
  }

  // If team profile, check membership
  if (profile.teamId) {
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId: profile.teamId,
        userId,
      },
    });

    if (!membership) {
      return { can: false, reason: "You don't have access to this profile" };
    }

    // VIEWER cannot edit
    if (membership.role === "VIEWER") {
      return { can: false, reason: "Viewers cannot edit profiles" };
    }

    return { can: true };
  }

  return { can: false, reason: "You don't have access to this profile" };
}

/**
 * Get the role of a user in a team
 */
export async function getUserTeamRole(userId: string, teamId: string): Promise<TeamRole | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true },
  });

  if (!team) return null;

  if (team.ownerId === userId) {
    return "OWNER";
  }

  const membership = await prisma.teamMember.findFirst({
    where: {
      teamId,
      userId,
    },
    select: { role: true },
  });

  return membership?.role || null;
}
