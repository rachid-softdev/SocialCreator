import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProfileCapStatus } from "@/lib/publish-guard";
import { AnalyticsDashboard } from "./analytics-dashboard";

export default async function AnalyticsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch user's profiles for selector
  const profiles = await prisma.profile.findMany({
    where: { userId: session.user.id, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (profiles.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader title="Analytics" description="Track your content performance" />
        <div className="text-center py-12">
          <p className="text-body-sm text-muted">Create a profile to start tracking analytics</p>
        </div>
      </div>
    );
  }

  // Fetch initial data for first profile
  const [firstProfile] = profiles;
  const [publishLogs, recentPublishes] = await Promise.all([
    prisma.publishLog.findMany({
      where: {
        profileId: firstProfile!.id,
        publishedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
    }),
    prisma.generatedContent.findMany({
      where: {
        profileId: firstProfile!.id,
        status: { in: ["PUBLISHED", "FAILED"] },
      },
      orderBy: { publishedAt: "desc" },
      take: 20,
      include: {
        profile: { select: { name: true } },
      },
    }),
  ]);

  const capStatus = await getProfileCapStatus(firstProfile!.id);

  return (
    <AnalyticsDashboard
      profiles={profiles}
      initialProfileId={firstProfile!.id}
      initialPublishLogs={publishLogs}
      initialRecentContent={recentPublishes.map((c) => ({
        ...c,
        profileName: c.profile?.name || "Unknown",
      }))}
      initialCapStatus={capStatus}
    />
  );
}
