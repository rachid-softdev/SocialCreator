"use client";

import type { AgentWithRelations } from "@socialcreator/types/agent";
import { Bot, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AgentList } from "@/components/agent/agent-list";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageHeader } from "@/components/layout/page-header";

interface AllAgentsClientProps {
  initialAgents: AgentWithRelations[];
  profiles: { id: string; name: string }[];
}

export function AllAgentsClient({ initialAgents, profiles }: AllAgentsClientProps) {
  const router = useRouter();
  const [agents, setAgents] = useState(initialAgents);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  const filteredAgents = selectedProfile
    ? agents.filter((a) => a.profile.id === selectedProfile)
    : agents;

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
      console.error("Error deleting agent", error);
    }
  };

  const handleEdit = (id: string) => {
    const agent = agents.find((a) => a.id === id);
    if (agent) {
      router.push(`/profiles/${agent.profile.id}/agents/${id}`);
    }
  };

  const totalAgents = filteredAgents.length;
  const activeAgents = filteredAgents.filter((a) => a.isActive).length;

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Agents" }]} />

      <PageHeader
        title="All Agents"
        description={`${totalAgents} agent${totalAgents !== 1 ? "s" : ""} · ${activeAgents} active`}
      />

      {/* Profile Filter */}
      {profiles.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setSelectedProfile(null)}
            className={`px-4 py-2 rounded-pill text-body-sm transition-colors ${
              !selectedProfile
                ? "bg-primary text-on-primary"
                : "bg-surface-strong text-muted hover:text-ink"
            }`}
          >
            All Profiles
          </button>
          {profiles.map((profile) => (
            <button
              type="button"
              key={profile.id}
              onClick={() => setSelectedProfile(profile.id)}
              className={`px-4 py-2 rounded-pill text-body-sm transition-colors ${
                selectedProfile === profile.id
                  ? "bg-primary text-on-primary"
                  : "bg-surface-strong text-muted hover:text-ink"
              }`}
            >
              {profile.name}
            </button>
          ))}
        </div>
      )}

      {filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-strong flex items-center justify-center mb-4">
            <Bot className="w-8 h-8 text-muted" />
          </div>
          <h3 className="text-title-sm text-ink mb-2">No agents yet</h3>
          <p className="text-body-sm text-muted mb-6 max-w-md">
            Create your first AI agent to start generating content automatically.
          </p>
          <Link
            href="/profiles"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Agent
          </Link>
        </div>
      ) : (
        <AgentList
          agents={filteredAgents.map((agent) => ({
            ...agent,
            stats: {
              totalRuns: agent._count?.runs || 0,
              successRate: 0,
            },
          }))}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
}
