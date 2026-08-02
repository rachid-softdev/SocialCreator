/**
 * Admin Stats API
 * GET /api/admin/stats — Global platform statistics
 */

import { startOfDay, startOfMonth, subDays } from "date-fns";
import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/rate-limit-redis";

// ── Types ────────────────────────────────────────────────────

interface TrendDataItem {
  date: string;
  count: number;
}

interface Trends {
  users: TrendDataItem[];
  content: TrendDataItem[];
  publications: TrendDataItem[];
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Aggregate an array of objects (each with a Date field) into daily counts
 * for the last 30 days. Days with zero items are included with count = 0.
 */
function aggregateByDate<T extends Record<string, Date>>(
  items: T[],
  dateField: keyof T,
): TrendDataItem[] {
  const map = new Map<string, number>();
  const now = new Date();

  // Initialize all 30 days with zero
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0]!;
    map.set(key, 0);
  }

  // Count items per day
  for (const item of items) {
    const d = item[dateField];
    if (d instanceof Date) {
      const key = d.toISOString().split("T")[0]!;
      map.set(key, (map.get(key) || 0) + 1);
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

async function computeTrends(): Promise<Trends> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [recentUsers, recentContent, recentPublications] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.generatedContent.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.publishLog.findMany({
      where: { publishedAt: { gte: thirtyDaysAgo } },
      select: { publishedAt: true },
      orderBy: { publishedAt: "asc" },
    }),
  ]);

  return {
    users: aggregateByDate(recentUsers, "createdAt"),
    content: aggregateByDate(recentContent, "createdAt"),
    publications: aggregateByDate(recentPublications, "publishedAt"),
  };
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const rateLimited = await withRateLimit(request, { userId: admin.id });
    if (rateLimited) return rateLimited;

    const now = new Date();
    const startToday = startOfDay(now);
    const startMonth = startOfMonth(now);
    const sevenDaysAgo = subDays(now, 7);

    const [
      totalUsers,
      newThisWeek,
      newThisMonth,
      totalOrgs,
      orgsWithSubscription,
      totalContent,
      publishedToday,
      publishedThisMonth,
      publishLogsToday,
      publishLogsThisMonth,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: startMonth } } }),
      prisma.organization.count(),
      prisma.organization.count({
        where: { subscription: { isNot: null } },
      }),
      prisma.generatedContent.count(),
      prisma.generatedContent.count({
        where: { publishedAt: { gte: startToday }, status: "PUBLISHED" },
      }),
      prisma.generatedContent.count({
        where: { publishedAt: { gte: startMonth }, status: "PUBLISHED" },
      }),
      prisma.publishLog.count({
        where: { publishedAt: { gte: startToday }, success: true },
      }),
      prisma.publishLog.count({
        where: { publishedAt: { gte: startMonth }, success: true },
      }),
    ]);

    // ── Trend data (last 30 days) ──────────────────────────────
    const url = new URL(request.url);
    const includeTrends = url.searchParams.get("includeTrends") === "true";

    let trends: Trends | undefined;
    if (includeTrends) {
      trends = await computeTrends();
    }

    return NextResponse.json({
      users: {
        total: totalUsers,
        newThisWeek,
        newThisMonth,
      },
      organizations: {
        total: totalOrgs,
        withSubscription: orgsWithSubscription,
      },
      content: {
        totalGenerated: totalContent,
        publishedToday,
        publishedThisMonth,
      },
      publications: {
        today: publishLogsToday,
        thisMonth: publishLogsThisMonth,
      },
      ...(includeTrends && { trends }),
    });
  } catch (e: unknown) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
