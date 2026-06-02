/**
 * API v1 /dashboard route
 * Aggregated dashboard stats and recent activity for the current user
 */

import { NextResponse } from "next/server";
import { withApiMiddleware } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/dashboard
export const GET = withApiMiddleware(async ({ userId }) => {
  const {
    content: contentRepo,
    publishLog: publishLogRepo,
    profile: profileRepo,
  } = getRepositories();

  const profiles = await profileRepo.findByUserId(userId);
  const profileIds = profiles.map((p) => p.id);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [totalContents, totalPublished, todayPublishes, recentLogs] = await Promise.all([
    // Total content count across all profiles
    Promise.all(profileIds.map((pid) => contentRepo.findByProfileId(pid, { pageSize: 1 }))).then(
      (results) => results.reduce((sum, r) => sum + r.total, 0),
    ),
    // Published content count across all profiles
    Promise.all(
      profileIds.map((pid) =>
        contentRepo.findByProfileId(pid, { status: "PUBLISHED", pageSize: 1 }),
      ),
    ).then((results) => results.reduce((sum, r) => sum + r.total, 0)),
    // Today's successful publishes across all platforms (uses prisma directly since
    // countPublishedToday requires a specific platform)
    Promise.all(
      profileIds.map((pid) =>
        prisma.publishLog.count({
          where: {
            profileId: pid,
            success: true,
            publishedAt: { gte: startOfDay },
          },
        }),
      ),
    ).then((counts) => counts.reduce((sum, c) => sum + c, 0)),
    // Recent publish logs for the user
    publishLogRepo.findByUserId(userId, { pageSize: 10 }),
  ]);

  return NextResponse.json({
    stats: {
      profiles: profiles.length,
      totalContents,
      totalPublished,
      todayPublishes,
    },
    recentActivity: recentLogs.logs || [],
  });
});
