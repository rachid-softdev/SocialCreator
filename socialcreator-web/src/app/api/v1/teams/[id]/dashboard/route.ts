/**
 * API v1 /teams/[id]/dashboard route
 * Returns aggregated team statistics for the team dashboard
 */

import { NextResponse } from "next/server";
import { notFound, unauthorized } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/teams/:id/dashboard — Aggregated team stats
export const GET = withApiMiddleware(async ({ userId }, params) => {
  const { team: teamRepo } = getRepositories();
  const team = await teamRepo.findById(params?.id as string);

  if (!team) return notFound("Team");

  // Check membership
  const isOwner = team.ownerId === userId;
  const isMember = team.members.some((m) => m.userId === userId);
  if (!isOwner && !isMember) return unauthorized();

  // Current date helpers
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Run queries in parallel
  const [
    profileCount,
    totalContentCreated,
    totalContentPublished,
    contentPublishedThisWeek,
    contentInReview,
    activeMemberIds,
    recentActivity,
  ] = await Promise.all([
    // Profile count
    prisma.profile.count({
      where: { teamId: team.id },
    }),

    // Total content created by team members
    prisma.generatedContent.count({
      where: {
        profile: {
          teamId: team.id,
        },
      },
    }),

    // Total content published
    prisma.generatedContent.count({
      where: {
        profile: { teamId: team.id },
        status: "PUBLISHED",
      },
    }),

    // Content published this week
    prisma.generatedContent.count({
      where: {
        profile: { teamId: team.id },
        status: "PUBLISHED",
        publishedAt: { gte: startOfWeek },
      },
    }),

    // Content in review
    prisma.generatedContent.count({
      where: {
        profile: { teamId: team.id },
        reviewStatus: "IN_REVIEW",
      },
    }),

    // Active members (created content in last 30 days)
    prisma.generatedContent.findMany({
      where: {
        profile: { teamId: team.id },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { profile: { select: { userId: true } } },
      distinct: ["profileId"],
    }),

    // Recent activity (last 20 published/reviewed items)
    prisma.generatedContent.findMany({
      where: {
        profile: { teamId: team.id },
        OR: [{ status: "PUBLISHED" }, { reviewStatus: { in: ["APPROVED", "REJECTED"] } }],
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        textContent: true,
        status: true,
        reviewStatus: true,
        updatedAt: true,
        profile: { select: { id: true, name: true } },
      },
    }),
  ]);

  // Count unique active members
  const activeUserIds = new Set(activeMemberIds.map((a) => a.profile.userId));
  const activeMembers = activeUserIds.size;

  // Calculate top contributors (by content count)
  const contentByMember = await prisma.generatedContent.groupBy({
    by: ["profileId"],
    where: {
      profile: { teamId: team.id },
      createdAt: { gte: thirtyDaysAgo },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  // Resolve top contributor details (no email leak)
  const profileIds = contentByMember.map((c) => c.profileId);
  const topProfiles =
    profileIds.length > 0
      ? await prisma.profile.findMany({
          where: { id: { in: profileIds } },
          select: { id: true, name: true, userId: true, user: { select: { name: true } } },
        })
      : [];

  const topContributors = contentByMember.map((c) => {
    const profile = topProfiles.find((p) => p.id === c.profileId);
    return {
      profileId: c.profileId,
      profileName: profile?.name ?? "Unknown",
      userName: profile?.user?.name ?? "Unknown",
      userId: profile?.userId ?? "",
      contentCount: c._count.id,
    };
  });

  // Format recent activity
  const formattedActivity = recentActivity.map((a) => ({
    id: a.id,
    contentPreview: a.textContent?.substring(0, 100) ?? "",
    status: a.status,
    reviewStatus: a.reviewStatus,
    profileId: a.profile.id,
    profileName: a.profile.name,
    updatedAt: a.updatedAt,
  }));

  return NextResponse.json(
    {
      team: {
        id: team.id,
        name: team.name,
        memberCount: team.members.length + 1, // +1 for owner
        profileCount,
      },
      totalContentCreated,
      totalContentPublished,
      contentPublishedThisWeek,
      contentInReview,
      activeMembers,
      topContributors,
      recentActivity: formattedActivity,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
