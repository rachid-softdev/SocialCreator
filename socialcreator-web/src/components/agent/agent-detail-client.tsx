"use client";

import type { AgentWithRelations } from "@socialcreator/types/agent";
import { AGENT_TYPE_LABELS } from "@socialcreator/types/agent";
import { cn } from "@socialcreator/utils";
import { Bot, FileText, Play, RefreshCw, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RunList } from "@/components/agent/run-list";
import { ContentList } from "@/components/content/content-list";
import { PlatformBadge } from "@/components/content/platform-badge";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import logger from "@/lib/logger";
import { AgentRunModal } from "./agent-run-modal";

interface AgentDetailClientProps {
  agent: AgentWithRelations & {
    stats: { totalRuns: number; successRate: number };
  };
  profileId: string;
}

type TabType = "overview" | "runs" | "content";

export function AgentDetailClient({ agent, profileId }: AgentDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isActive, setIsActive] = useState(agent.isActive);
  const [showRunModal, setShowRunModal] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [runsPage, setRunsPage] = useState(1);
  const [runsTotalPages, setRunsTotalPages] = useState(1);

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Settings },
    { id: "runs" as const, label: "Runs", icon: RefreshCw, count: agent._count?.runs || 0 },
    {
      id: "content" as const,
      label: "Content",
      icon: FileText,
      count: (agent._count as any)?.generatedContents || 0,
    },
  ];

  const handleToggleActive = async () => {
    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        setIsActive(!isActive);
      }
    } catch (error) {
      logger.error({ err: error }, "Error toggling agent");
    }
  };

  const fetchRuns = async (page: number = 1) => {
    setIsLoadingRuns(true);
    try {
      const response = await fetch(`/api/agents/${agent.id}/run?page=${page}&pageSize=10`);
      if (response.ok) {
        const data = await response.json();
        setRuns(data.runs);
        setRunsPage(data.page);
        setRunsTotalPages(data.totalPages);
      }
    } catch (error) {
      logger.error({ err: error }, "Error fetching runs");
    } finally {
      setIsLoadingRuns(false);
    }
  };

  // Load runs when tab changes
  if (activeTab === "runs" && runs.length === 0 && !isLoadingRuns) {
    fetchRuns();
  }

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Profiles", href: "/profiles" },
          { label: agent.profile.name, href: `/profiles/${profileId}` },
          { label: "Agents", href: `/profiles/${profileId}/agents` },
          { label: agent.name },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-surface-strong flex items-center justify-center">
            <Bot className="w-7 h-7 text-body" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-display-sm text-ink">{agent.name}</h1>
              {isActive ? (
                <span className="px-2 py-0.5 rounded-full bg-semantic-success/10 text-caption text-semantic-success">
                  Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-muted-soft text-caption text-muted">
                  Paused
                </span>
              )}
            </div>
            <p className="text-body-sm text-muted">{AGENT_TYPE_LABELS[agent.type]}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle Active */}
          <button
            type="button"
            onClick={handleToggleActive}
            className={cn(
              "relative w-12 h-6 rounded-full transition-colors",
              isActive ? "bg-semantic-success" : "bg-muted-soft",
            )}
          >
            <span
              className={cn(
                "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                isActive ? "left-7" : "left-1",
              )}
            />
          </button>

          {/* Run Agent */}
          <button
            type="button"
            onClick={() => setShowRunModal(true)}
            disabled={!isActive}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            Run Agent
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-hairline">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-body-sm border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-primary text-ink"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className="px-1.5 py-0.5 rounded bg-surface-strong text-caption">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Config Card */}
            <div className="bg-surface-card rounded-xl border border-hairline p-6">
              <h3 className="text-title-sm text-ink mb-4">Configuration</h3>
              <dl className="space-y-4">
                <div>
                  <dt className="text-caption text-muted">Platforms</dt>
                  <dd className="flex flex-wrap gap-2 mt-1">
                    {agent.platforms.map((platform) => (
                      <PlatformBadge key={platform} platform={platform} size="sm" />
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-muted">Schedule</dt>
                  <dd className="text-body-sm text-ink mt-1">
                    {agent.scheduleCron || "Manual runs only"}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-muted">Max runs per day</dt>
                  <dd className="text-body-sm text-ink mt-1">{agent.maxPerDay}</dd>
                </div>
                <div>
                  <dt className="text-caption text-muted">Auto-publish</dt>
                  <dd className="text-body-sm text-ink mt-1">
                    {agent.autoPublish ? "Enabled" : "Disabled"}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Stats Card */}
            <div className="bg-surface-card rounded-xl border border-hairline p-6">
              <h3 className="text-title-sm text-ink mb-4">Statistics</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-4 bg-surface-strong rounded-xl">
                  <p className="text-display-sm text-ink">{agent.stats.totalRuns}</p>
                  <p className="text-caption text-muted">Total Runs</p>
                </div>
                <div className="text-center p-4 bg-surface-strong rounded-xl">
                  <p className="text-display-sm text-ink">{agent.stats.successRate}%</p>
                  <p className="text-caption text-muted">Success Rate</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "runs" && (
          <RunList
            runs={runs}
            agentId={agent.id}
            profileId={profileId}
            pagination={
              runsTotalPages > 1
                ? {
                    page: runsPage,
                    totalPages: runsTotalPages,
                    onPageChange: (page) => fetchRuns(page),
                  }
                : undefined
            }
            onRerun={async (runId) => {
              try {
                const response = await fetch(`/api/agents/${agent.id}/runs/${runId}/rerun`, {
                  method: "POST",
                });
                if (response.ok) {
                  fetchRuns(runsPage);
                  router.refresh();
                }
              } catch (error) {
                logger.error({ err: error }, "Error rerunning");
              }
            }}
          />
        )}

        {activeTab === "content" && <ContentListForAgent agentId={agent.id} />}
      </div>

      {/* Run Modal */}
      <AgentRunModal
        isOpen={showRunModal}
        onClose={() => setShowRunModal(false)}
        agentId={agent.id}
        agentName={agent.name}
        onSuccess={() => {
          router.refresh();
          if (activeTab === "runs") {
            fetchRuns(runsPage);
          }
        }}
      />
    </div>
  );
}

function ContentListForAgent({ agentId }: { agentId: string }) {
  const [contents, setContents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useState(() => {
    fetch(`/api/content?agentId=${agentId}`)
      .then((res) => res.json())
      .then((data) => {
        setContents(data.contents || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <ContentList contents={contents} />;
}
