/**
 * GET /api/analytics
 * Fetch publication analytics for a profile
 *
 * Query params:
 * - profileId: string (required)
 * - from: ISO date string (optional, defaults to 30 days ago)
 * - to: ISO date string (optional, defaults to now)
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDayUTC } from "@/lib/utils";
import { Platform } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (!profileId) {
      return NextResponse.json(
        { error: "Missing profileId" },
        { status: 400 }
      );
    }

    // Verify user owns this profile
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId: session.user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Default date range: last 30 days
    const to = toParam ? new Date(toParam) : new Date();
    const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch PublishLogs in range
    const publishLogs = await prisma.publishLog.findMany({
      where: {
        profileId,
        publishedAt: {
          gte: startOfDayUTC(from),
          lte: to,
        },
      },
      orderBy: { publishedAt: "asc" },
    });

    // Fetch Analytics records in range
    const analytics = await prisma.analytics.findMany({
      where: {
        profileId,
        date: {
          gte: startOfDayUTC(from),
          lte: to,
        },
      },
      orderBy: { date: "asc" },
    });

    // Aggregate daily data
    const dailyMap = new Map<string, { date: string; count: number; success: number; failed: number }>();

    publishLogs.forEach((log) => {
      const dateStr = log.publishedAt.toISOString().split("T")[0];
      const existing = dailyMap.get(dateStr) || { date: dateStr, count: 0, success: 0, failed: 0 };
      existing.count++;
      if (log.success) {
        existing.success++;
      } else {
        existing.failed++;
      }
      dailyMap.set(dateStr, existing);
    });

    const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Aggregate platform breakdown
    const platformMap = new Map<Platform, { posts: number; impressions: number; engagements: number }>();

    publishLogs.forEach((log) => {
      const existing = platformMap.get(log.platform) || { posts: 0, impressions: 0, engagements: 0 };
      existing.posts++;
      platformMap.set(log.platform, existing);
    });

    analytics.forEach((record) => {
      const existing = platformMap.get(record.platform) || { posts: 0, impressions: 0, engagements: 0 };
      existing.impressions += record.impressions;
      existing.engagements += record.engagements;
      platformMap.set(record.platform, existing);
    });

    const platformBreakdown = Object.fromEntries(platformMap);

    // Calculate totals
    const totalImpressions = analytics.reduce((sum, r) => sum + r.impressions, 0);
    const totalEngagements = analytics.reduce((sum, r) => sum + r.engagements, 0);
    const totalPosts = publishLogs.filter((l) => l.success).length;

    return NextResponse.json(
      {
        daily,
        platformBreakdown,
        totals: {
          posts: totalPosts,
          impressions: totalImpressions,
          engagements: totalEngagements,
        },
        dateRange: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
