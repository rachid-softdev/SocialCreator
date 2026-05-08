import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { AgentDetailClient } from "@/components/agent/agent-detail-client";
import { AgentRunModal } from "@/components/agent/agent-run-modal";

interface PageProps {
  params: Promise<{ profileId: string; agentId: string }>;
}

export default async function AgentDetailPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { profileId, agentId } = await params;

  // Fetch agent with profile
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      profileId,
      profile: { userId: session.user.id },
    },
    include: {
      profile: {
        select: { id: true, name: true },
      },
      _count: {
        select: {
          runs: true,
          generatedContents: true,
        },
      },
    },
  });

  if (!agent) {
    notFound();
  }

  // Calculate stats
  const totalRuns = await prisma.agentRun.count({
    where: { agentId },
  });
  const successRuns = await prisma.agentRun.count({
    where: { agentId, status: "SUCCESS" },
  });

  return (
    <AgentDetailClient
      agent={{
        ...agent,
        stats: {
          totalRuns,
          successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0,
        },
      }}
      profileId={profileId}
    />
  );
}
