"use client";

import { useState, memo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ContentList } from "@/components/content/content-list";
import { ApprovalPanel } from "@/components/content/approval-panel";
import type { GeneratedContentWithRelations } from "@socialcreator/types/agent";
import { CONTENT_STATUS_LABELS } from "@socialcreator/types/profile";
import type { ContentStatus } from "@prisma/client";
import { cn } from "@socialcreator/utils";

interface ContentPageClientProps {
  initialContents: GeneratedContentWithRelations[];
  stats: Record<string, number>;
}

// Memoize pour éviter les re-renders inutiles
export const ContentPageClient = memo(function ContentPageClient({ initialContents, stats }: ContentPageClientProps) {
  const [contents, setContents] = useState(initialContents);
  const [selectedContent, setSelectedContent] = useState<GeneratedContentWithRelations | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const handleApprove = async (id: string) => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/content/${id}/approve`, {
        method: "POST",
      });

      if (response.ok) {
        setContents(contents.map((c) =>
          c.id === id ? { ...c, status: "APPROVED" } : c
        ));
        setSelectedContent(null);
      }
    } catch (error) {
      console.error("Error approving:", error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/content/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        setContents(contents.map((c) =>
          c.id === id ? { ...c, status: "REJECTED" } : c
        ));
        setSelectedContent(null);
      }
    } catch (error) {
      console.error("Error rejecting:", error);
    } finally {
      setIsApproving(false);
    }
  };

  const totalContent = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Content Library"
        description={`${totalContent} content pieces generated`}
      />

      {/* Quick Stats */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        <div className="flex items-center gap-2 px-4 py-2 rounded-pill bg-surface-strong">
          <span className="text-caption text-muted">Total:</span>
          <span className="text-body-strong text-ink">{totalContent}</span>
        </div>
        {Object.entries(CONTENT_STATUS_LABELS).map(([status, label]) => {
          const count = stats[status] || 0;
          return (
            <div
              key={status}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-pill",
                count > 0 ? "bg-surface-strong" : "bg-surface-strong/50 opacity-50"
              )}
            >
              <span className="text-caption text-muted">{label}:</span>
              <span className="text-body-strong text-ink">{count}</span>
            </div>
          );
        })}
      </div>

      <ContentList
        contents={contents}
        onApprove={(id) => {
          const content = contents.find((c) => c.id === id);
          if (content) setSelectedContent(content);
        }}
        onReject={handleReject}
      />

      <ApprovalPanel
        content={selectedContent}
        isOpen={!!selectedContent}
        onClose={() => setSelectedContent(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        isLoading={isApproving}
      />
    </div>
  );
});

// Display name pour les DevTools React
ContentPageClient.displayName = 'ContentPageClient'