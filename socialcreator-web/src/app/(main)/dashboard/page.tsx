import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { PageHeader } from "@/components/layout/page-header";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { RecentContent } from "@/components/dashboard/recent-content";
import { ActiveAgents } from "@/components/dashboard/active-agents";
import { QuickActions } from "@/components/dashboard/quick-actions";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // Fetch dashboard data
  const [
    profileCount,
    activeAgentsCount,
    pendingDrafts,
    publishedThisWeek,
    recentContents,
    activeAgents,
  ] = await Promise.all([
    prisma.profile.count({ where: { userId: session.user.id } }),
    prisma.agent.count({
      where: { profile: { userId: session.user.id }, isActive: true },
    }),
    prisma.generatedContent.count({
      where: {
        profile: { userId: session.user.id },
        status: "DRAFT",
      },
    }),
    prisma.generatedContent.count({
      where: {
        profile: { userId: session.user.id },
        status: "PUBLISHED",
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.generatedContent.findMany({
      where: { profile: { userId: session.user.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { profile: { select: { name: true } } },
    }),
    prisma.agent.findMany({
      where: { profile: { userId: session.user.id }, isActive: true },
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: {
        profile: { select: { name: true } },
        runs: { orderBy: { startedAt: "desc" }, take: 1 },
      },
    }),
  ]);

  const formattedDate = format(new Date(), "EEEE, MMMM d, yyyy");

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title={`Welcome back, ${session.user.name?.split(" ")[0] || "there"}`}
        description={formattedDate}
      />

      {/* Stats Grid */}
      <StatsGrid
        stats={{
          totalProfiles: profileCount,
          activeAgents: activeAgentsCount,
          pendingDrafts,
          publishedThisWeek,
        }}
      />

      {/* Quick Actions */}
      <QuickActions />

      {/* Content & Agents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentContent
          contents={recentContents.map((content) => ({
            ...content,
            profileName: content.profile.name,
          }))}
        />
        <ActiveAgents
          agents={activeAgents.map((agent) => ({
            ...agent,
            profileName: agent.profile.name,
            lastRun: agent.runs[0] || undefined,
          }))}
        />
      </div>
    </div>
  );
}
