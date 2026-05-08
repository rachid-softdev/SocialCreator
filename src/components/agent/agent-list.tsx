"use client";

import { Bot, Plus } from "lucide-react";
import Link from "next/link";
import { AgentCard } from "./agent-card";
import type { AgentWithRelations } from "@/types/agent";

interface AgentListProps {
  agents: (AgentWithRelations & { stats: { totalRuns: number; successRate: number } })[];
  profileId?: string;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
}

export function AgentList({ agents, profileId, onDelete, onEdit }: AgentListProps) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-strong flex items-center justify-center mb-4">
          <Bot className="w-8 h-8 text-muted" />
        </div>
        <h3 className="text-title-sm text-ink mb-2">No agents yet</h3>
        <p className="text-body-sm text-muted mb-6 max-w-md">
          Create your first AI agent to start generating content automatically across your social
          media platforms.
        </p>
        {profileId && (
          <Link
            href={`/profiles/${profileId}/agents/new`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Agent
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
