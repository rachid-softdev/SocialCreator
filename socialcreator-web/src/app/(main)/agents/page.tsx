import { redirect } from "next/navigation";
import { AllAgentsClient } from "@/components/agent/all-agents-client";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageHeader } from "@/components/layout/page-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AllAgentsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch all agents for the user
  const [agents, profiles] = await Promise.all([
    prisma.agent.findMany({
      where: {
        profile: { userId: session.user.id },
      },
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
    }),
    prisma.profile.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

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

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Agents" }]} />
      <PageHeader title="Agents" description="Manage your AI content agents" />
      <AllAgentsClient initialAgents={agentsWithStats} profiles={profiles} />
    </div>
  );
}
