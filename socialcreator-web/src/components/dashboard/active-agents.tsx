"use client";

import type { Agent, AgentType, Platform } from "@prisma/client";
import { PLATFORMS } from "@socialcreator/types/profile";
import { formatDateTime } from "@socialcreator/utils";
import { Bot } from "lucide-react";

interface ActiveAgentsProps {
  agents?: Array<Agent & { profileName?: string; lastRun?: { startedAt: Date | null } }>;
}

const agentTypeLabels: Record<AgentType, string> = {
  TEXT_POST: "Text Post",
  VIDEO_CLIP: "Video Clip",
  CROSS_POST: "Cross Post",
};

function getPlatformIcons(platforms: Platform[]) {
  return platforms.slice(0, 3).map((platform) => {
    const platformInfo = PLATFORMS.find((p) => p.value === platform);
    return platformInfo?.icon || "";
  });
}

export function ActiveAgents({ agents }: ActiveAgentsProps) {
  const defaultAgents: typeof agents = [];

  const displayAgents = agents?.length ? agents : defaultAgents;

  if (displayAgents.length === 0) {
    return (
      <div className="bg-surface-card border border-hairline rounded-xl p-6">
        <h3 className="text-title-sm text-ink mb-4">Active Agents</h3>
        <p className="text-body-sm text-muted">
          No active agents. Create a profile and add an agent to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-card border border-hairline rounded-xl p-6">
      <h3 className="text-title-sm text-ink mb-4">Active Agents</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayAgents.map((agent) => (
          <div
            key={agent.id}
            className="flex items-start gap-4 p-4 rounded-lg bg-surface-strong hover:shadow-card-hover transition-shadow cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-peach flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-ink" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-body-strong text-ink truncate">{agent.name}</h4>
              </div>
              <p className="text-caption text-muted mb-2">{agentTypeLabels[agent.type]}</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {getPlatformIcons(agent.platforms).map((icon, idx) => (
                    <span key={idx} className="text-sm">
                      {icon}
                    </span>
                  ))}
                </div>
                {agent.lastRun?.startedAt && (
                  <span className="text-caption text-muted-soft ml-auto">
                    Last run: {formatDateTime(agent.lastRun.startedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
