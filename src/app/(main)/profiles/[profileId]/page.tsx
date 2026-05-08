import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BadgePill } from "@/components/ui/badge-pill";
import { Users, Bot, FileText, Link2 } from "lucide-react";
import { PLATFORMS } from "@/types/profile";
import { formatDate } from "@/lib/utils";

interface ProfileDetailPageProps {
  params: Promise<{ profileId: string }>;
}

export default async function ProfileDetailPage({ params }: ProfileDetailPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { profileId } = await params;

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: session.user.id },
    include: {
      _count: {
        select: {
          agents: true,
          generatedContents: true,
          connectedAccounts: true,
        },
      },
      agents: {
        where: { isActive: true },
        take: 3,
      },
      generatedContents: {
        where: { status: "PUBLISHED" },
        take: 5,
        orderBy: { publishedAt: "desc" },
      },
    },
  });

  if (!profile) {
    notFound();
  }

  const approvalRate = profile._count.generatedContents > 0
    ? Math.round(
        ((profile._count.generatedContents - profile.generatedContents.filter(c => c.status === "REJECTED").length) /
        profile._count.generatedContents) * 100
      )
    : 0;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Profiles", href: "/profiles" },
          { label: profile.name },
        ]}
      />

      <PageHeader
        title={profile.name}
        actions={
          <div className="flex items-center gap-3">
            <Link
              href={`/profiles/${profile.id}/edit`}
              className="px-4 py-2 rounded-pill border border-hairline-strong text-body-strong text-ink hover:bg-surface-strong transition-colors"
            >
              Edit
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <div className="bg-surface-card border border-hairline rounded-xl p-6">
            <h2 className="text-title-sm text-ink mb-4">Overview</h2>
            
            {/* Platforms */}
            {profile.platforms.length > 0 && (
              <div className="mb-6">
                <p className="text-caption text-muted mb-2">Platforms</p>
                <div className="flex flex-wrap gap-2">
                  {profile.platforms.map((platform) => {
                    const platformInfo = PLATFORMS.find((p) => p.value === platform);
                    return (
                      <BadgePill key={platform}>
                        <span>{platformInfo?.icon}</span> {platformInfo?.label}
                      </BadgePill>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Brand Voice */}
            {profile.brandVoice && (
              <div className="mb-6">
                <p className="text-caption text-muted mb-2">Brand Voice</p>
                <p className="text-body-sm text-body whitespace-pre-wrap">{profile.brandVoice}</p>
              </div>
            )}

            {/* Content Bank */}
            {profile.contentBank && (
              <div>
                <p className="text-caption text-muted mb-2">Content Bank</p>
                <p className="text-body-sm text-body whitespace-pre-wrap line-clamp-4">
                  {profile.contentBank}
                </p>
              </div>
            )}

            {/* Status */}
            <div className="mt-6 pt-6 border-t border-hairline">
              <span className={`px-3 py-1 rounded-pill text-caption ${profile.isActive ? "bg-semantic-success/10 text-semantic-success" : "bg-muted-soft/20 text-muted"}`}>
                {profile.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Recent Content */}
          {profile.generatedContents.length > 0 && (
            <div className="bg-surface-card border border-hairline rounded-xl p-6">
              <h2 className="text-title-sm text-ink mb-4">Recent Content</h2>
              <div className="space-y-3">
                {profile.generatedContents.map((content) => (
                  <div key={content.id} className="flex items-center justify-between py-2 border-b border-hairline-soft last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-caption text-muted">
                        {PLATFORMS.find(p => p.value === content.platform)?.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-caption ${content.status === "PUBLISHED" ? "bg-semantic-success/10 text-semantic-success" : "bg-muted-soft/20 text-muted"}`}>
                        {content.status}
                      </span>
                    </div>
                    <span className="text-caption text-muted-soft">
                      {formatDate(content.publishedAt || content.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-6">
          <div className="bg-surface-card border border-hairline rounded-xl p-6">
            <h2 className="text-title-sm text-ink mb-4">Stats</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-body-sm text-muted">
                  <Users className="w-4 h-4" />
                  Agents
                </div>
                <span className="text-body-strong text-ink">{profile._count.agents}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-body-sm text-muted">
                  <FileText className="w-4 h-4" />
                  Contents
                </div>
                <span className="text-body-strong text-ink">{profile._count.generatedContents}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-body-sm text-muted">
                  <Link2 className="w-4 h-4" />
                  Accounts
                </div>
                <span className="text-body-strong text-ink">{profile._count.connectedAccounts}</span>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-hairline">
                <span className="text-body-sm text-muted">Approval Rate</span>
                <span className="text-body-strong text-ink">{approvalRate}%</span>
              </div>
            </div>
          </div>

          {/* Active Agents */}
          {profile.agents.length > 0 && (
            <div className="bg-surface-card border border-hairline rounded-xl p-6">
              <h2 className="text-title-sm text-ink mb-4">Active Agents</h2>
              <div className="space-y-3">
                {profile.agents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-peach flex items-center justify-center">
                      <Bot className="w-4 h-4 text-ink" />
                    </div>
                    <div>
                      <p className="text-body-sm text-ink">{agent.name}</p>
                      <p className="text-caption text-muted">{agent.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}