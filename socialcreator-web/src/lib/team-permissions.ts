/**
 * Team Permissions Middleware
 * Vérifie les permissions des utilisateurs pour les actions sur les teams et profiles
 */

import { prisma } from "./prisma";
import { TeamRole } from "@prisma/client";

export interface PermissionCheck {
  can: boolean;
  reason?: string;
}

/**
 * Vérifie si un user peut accéder à une team
 */
export async function checkTeamAccess(
  userId: string,
  teamId: string
): Promise<PermissionCheck> {
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
 * Vérifie si un user peut modifier le rôle d'un membre
 * Seul le OWNER peut modifier les rôles
 */
export async function canModifyMemberRole(
  userId: string,
  teamId: string,
  targetMemberId: string
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
 * Vérifie si un user peut supprimer un membre
 * OWNER et ADMIN peuvent supprimer des membres
 */
export async function canRemoveMember(
  userId: string,
  teamId: string,
  targetMemberId: string
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
 * Vérifie si un user peut supprimer la team
 * Seul le OWNER peut supprimer
 */
export async function canDeleteTeam(
  userId: string,
  teamId: string
): Promise<PermissionCheck> {
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
 * Vérifie si un user peut éditer un profile partagé
 */
export async function canEditProfile(
  userId: string,
  profileId: string
): Promise<PermissionCheck> {
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
 * Récupère le rôle d'un user dans une team
 */
export async function getUserTeamRole(
  userId: string,
  teamId: string
): Promise<TeamRole | null> {
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