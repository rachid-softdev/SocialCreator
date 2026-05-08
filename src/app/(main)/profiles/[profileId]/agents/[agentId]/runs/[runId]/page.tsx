import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { RunDetail } from "@/components/agent/run-detail";
import { RunStatusBadge } from "@/components/agent/run-status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ profileId: string; agentId: string; runId: string }>;
}

export default async function RunDetailPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { profileId, agentId, runId } = await params;

  // Verify agent ownership
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

  // Fetch run
  const run = await prisma.agentRun.findFirst({
    where: { id: runId, agentId },
    include: {
      agent: {
        select: { id: true, name: true, type: true },
      },
      generatedContents: {
        orderBy: { platform: "asc" },
        include: {
          profile: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!run) {
    notFound();
  }

  // Calculate duration
  let duration: number | null = null;
  if (run.startedAt && run.finishedAt) {
    duration = Math.round(
      (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
    );
  }

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Profiles", href: "/profiles" },
          { label: agent.profile.name, href: `/profiles/${profileId}` },
          { label: "Agents", href: `/profiles/${profileId}/agents` },
          { label: agent.name, href: `/profiles/${profileId}/agents/${agentId}` },
          { label: `Run #${runId.slice(-6)}` },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm text-ink">Run Details</h1>
          <p className="text-body-sm text-muted mt-1">
            {formatDateTime(run.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/profiles/${profileId}/agents/${agentId}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pill text-button text-muted hover:bg-surface-strong transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Agent
          </Link>
          {run.status === "FAILED" && (
            <form action={`/api/agents/${agentId}/runs/${runId}/rerun`} method="POST">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Rerun
              </button>
            </form>
          )}
        </div>
      </div>

      <RunDetail run={{ ...run, duration }} />
    </div>
  );
}
