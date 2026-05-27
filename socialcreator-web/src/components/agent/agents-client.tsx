"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { AgentList } from "@/components/agent/agent-list";
import { EmptyState } from "@socialcreator/ui/empty-state";
import { Bot, Plus } from "lucide-react";
import Link from "next/link";
import type { AgentWithRelations } from "@socialcreator/types/agent";

interface AgentsClientProps {
  profileId: string;
  initialAgents: AgentWithRelations[];
}

export function AgentsClient({ profileId, initialAgents }: AgentsClientProps) {
  const router = useRouter();
  const [agents, setAgents] = useState(initialAgents);
  const [isLoading, setIsLoading] = useState(false);

  // Stats
  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.isActive).length;

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/agents/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setAgents(agents.filter((a) => a.id !== id));
        router.refresh();
      }
    } catch (error) {
      console.error("Error deleting agent:", error);
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/profiles/${profileId}/agents/${id}`);
  };

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Profiles", href: "/profiles" }, { label: "Agents" }]} />

      <PageHeader
        title="AI Agents"
        description={`${totalAgents} agent${totalAgents !== 1 ? "s" : ""} · ${activeAgents} active`}
        actions={
          <Link
            href={`/profiles/${profileId}/agents/new`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Agent
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <AgentList
          agents={agents.map((agent) => ({
            ...agent,
            stats: {
              totalRuns: agent._count?.runs || 0,
              successRate: 0,
            },
          }))}
          profileId={profileId}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
}
