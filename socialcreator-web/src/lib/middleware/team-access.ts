/**
 * Team Access Middleware
 * Utilities for checking team membership and role-based permissions
 */

import type { TeamRole } from "@prisma/client";
import type { NextResponse } from "next/server";
import { forbidden, notFound } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

// ============================================
// Types
// ============================================

export interface TeamAccessInfo {
  teamId: string;
  userId: string;
  role: TeamRole;
}

// ============================================
// Access Check
// ============================================

/**
 * Check if a user has access to a team with the required role(s).
 * Returns TeamAccessInfo if access is granted, or an error Response if denied.
 *
 * @param userId - The user's ID
 * @param teamId - The team's ID
 * @param requiredRoles - Optional array of roles that are allowed (default: any member)
 */
export async function withTeamAccess(
  userId: string,
  teamId: string,
  requiredRoles?: TeamRole[],
): Promise<TeamAccessInfo | NextResponse> {
  // Check if user is owner
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true },
  });

  if (!team) {
    return notFound("Team");
  }

  // Owner has full access regardless of requiredRoles
  if (team.ownerId === userId) {
    return { teamId, userId, role: "OWNER" };
  }

  // Check membership
  const membership = await prisma.teamMember.findFirst({
    where: { teamId, userId },
    select: { role: true },
  });

  if (!membership) {
    return forbidden("You are not a member of this team");
  }

  // If specific roles are required, check them
  if (requiredRoles && requiredRoles.length > 0) {
    if (!requiredRoles.includes(membership.role)) {
      return forbidden(
        `This action requires one of the following roles: ${requiredRoles.join(", ")}`,
      );
    }
  }

  return { teamId, userId, role: membership.role };
}

// ============================================
// Role Checks
// ============================================

/**
 * Check if a role can review content (OWNER or ADMIN)
 */
export function canReview(role: TeamRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Check if a role can submit content for review (OWNER, ADMIN, or EDITOR)
 */
export function canSubmitForReview(role: TeamRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "EDITOR";
}
