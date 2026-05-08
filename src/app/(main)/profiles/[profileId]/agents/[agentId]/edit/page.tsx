import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { AgentForm } from "@/components/agent/agent-form";

interface PageProps {
  params: Promise<{ profileId: string; agentId: string }>;
}

export default async function EditAgentPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { profileId, agentId } = await params;

  // Fetch agent
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      profileId,
      profile: { userId: session.user.id },
    },
  });

  if (!agent) {
    notFound();
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <Breadcrumb
        items={[
          { label: "Profiles", href: "/profiles" },
          { label: agent.profile.name, href: `/profiles/${profileId}` },
          { label: "Agents", href: `/profiles/${profileId}/agents` },
          { label: agent.name, href: `/profiles/${profileId}/agents/${agentId}` },
          { label: "Edit" },
        ]}
      />

      <PageHeader
        title="Edit Agent"
        description="Update your agent configuration"
      />

      <div className="bg-surface-card rounded-xl border border-hairline p-6">
        <AgentForm
          profileId={profileId}
          agentId={agentId}
          initialData={{
            name: agent.name,
            type: agent.type,
            platforms: agent.platforms as any,
            scheduleCron: agent.scheduleCron,
            autoPublish: agent.autoPublish,
            maxPerDay: agent.maxPerDay,
          }}
          isEdit
        />
      </div>
    </div>
  );
}
