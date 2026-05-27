import { notFound, redirect } from "next/navigation";
import { AgentForm } from "@/components/agent/agent-form";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageHeader } from "@/components/layout/page-header";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ profileId: string }>;
}

export default async function NewAgentPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { profileId } = await params;

  // Verify profile ownership
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: session.user.id },
  });

  if (!profile) {
    notFound();
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <Breadcrumb
        items={[
          { label: "Profiles", href: "/profiles" },
          { label: profile.name, href: `/profiles/${profileId}` },
          { label: "Agents", href: `/profiles/${profileId}/agents` },
          { label: "New Agent" },
        ]}
      />

      <PageHeader
        title="Create New Agent"
        description="Set up an AI agent to generate content for your social media platforms"
      />

      <div className="bg-surface-card rounded-xl border border-hairline p-6">
        <AgentForm profileId={profileId} />
      </div>
    </div>
  );
}
