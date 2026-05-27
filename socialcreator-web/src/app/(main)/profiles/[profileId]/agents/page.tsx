import { notFound, redirect } from "next/navigation";
import { AgentsClient } from "@/components/agent/agents-client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ profileId: string }>;
}

export default async function AgentsPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { profileId } = await params;

  // Fetch profile and verify ownership
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: session.user.id },
  });

  if (!profile) {
    notFound();
  }

  // Fetch agents
  const agents = await prisma.agent.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    include: {
      profile: {
        select: { id: true, name: true },
      },
      _count: {
        select: {
          runs: true,
        },
      },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Calculate stats
  const agentsWithStats = await Promise.all(
    agents.map(async (agent) => {
      const totalRuns = await prisma.agentRun.count({
        where: { agentId: agent.id },
      });
      const successRuns = await prisma.agentRun.count({
        where: { agentId: agent.id, status: "SUCCESS" },
      });

      return {
        ...agent,
        stats: {
          totalRuns,
          successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0,
        },
      };
    }),
  );

  return <AgentsClient profileId={profileId} initialAgents={agentsWithStats} />;
}
