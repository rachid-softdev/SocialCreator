/**
 * Admin Stats API
 * GET /api/admin/stats — Global platform statistics
 */

import { startOfDay, startOfMonth, subDays } from "date-fns";
import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();

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

    return NextResponse.json({
      users: {
        total: totalUsers,
        activeThisMonth: newThisMonth,
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
    });
  } catch (e: unknown) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
