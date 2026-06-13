import { format } from "date-fns";
import { Plus, Sparkles, Target, Users } from "lucide-react";
import Link from "next/link";
import { ActiveAgents } from "@/components/dashboard/active-agents";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentContent } from "@/components/dashboard/recent-content";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageHeader } from "@/components/layout/page-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const isNewUser = profileCount === 0;

  if (isNewUser) {
    return (
      <div className="space-y-8">
        <Breadcrumb items={[{ label: "Dashboard" }]} />
        <PageHeader
          title={`Welcome, ${session.user.name?.split(" ")[0] || "there"}`}
          description="Let's get you set up — you're just a few steps away from your first post."
        />

        <div className="bg-surface-card border border-hairline rounded-xl p-8 md:p-12">
          <div className="max-w-lg mx-auto text-center space-y-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-mint flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-ink" />
            </div>

            <div className="space-y-2">
              <h2 className="text-display-sm font-display text-ink">Create your first profile</h2>
              <p className="text-body-md text-muted">
                A profile represents a brand or persona. Connect your social accounts, set up agents
                to generate content, and start publishing.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <div className="p-4 rounded-lg bg-surface-soft space-y-2">
                <div className="w-10 h-10 rounded-lg bg-surface-strong flex items-center justify-center">
                  <Users className="w-5 h-5 text-muted" />
                </div>
                <h3 className="text-body-strong text-ink">1. Create a profile</h3>
                <p className="text-caption text-muted">
                  Define your brand voice and connect platforms
                </p>
              </div>
              <div className="p-4 rounded-lg bg-surface-soft space-y-2">
                <div className="w-10 h-10 rounded-lg bg-surface-strong flex items-center justify-center">
                  <Target className="w-5 h-5 text-muted" />
                </div>
                <h3 className="text-body-strong text-ink">2. Set up agents</h3>
                <p className="text-caption text-muted">
                  Configure AI agents to generate content for you
                </p>
              </div>
              <div className="p-4 rounded-lg bg-surface-soft space-y-2">
                <div className="w-10 h-10 rounded-lg bg-surface-strong flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-muted" />
                </div>
                <h3 className="text-body-strong text-ink">3. Generate & publish</h3>
                <p className="text-caption text-muted">
                  Create content and publish across all your platforms
                </p>
              </div>
            </div>

            <Link
              href="/profiles/new"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Your First Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Dashboard" }]} />
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

      {/* Dashboard Analytics */}
      <section>
        <h2 className="text-title-md text-ink font-medium mb-4">Analytics</h2>
        <DashboardStats />
      </section>
    </div>
  );
}
