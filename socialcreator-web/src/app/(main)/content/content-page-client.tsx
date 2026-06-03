"use client";

import type { ContentStatus, Platform } from "@prisma/client";
import type { GeneratedContentWithRelations } from "@socialcreator/types/agent";
import { CONTENT_STATUS_LABELS } from "@socialcreator/types/profile";
import { cn } from "@socialcreator/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useState } from "react";
import { ApprovalPanel } from "@/components/content/approval-panel";
import { ContentList } from "@/components/content/content-list";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SearchBar } from "@/components/shared/search-bar";
import logger from "@/lib/logger";

interface ContentPageClientProps {
  initialContents: GeneratedContentWithRelations[];
  stats: Record<string, number>;
  initialPage: number;
  initialQuery: string;
  initialStatus: string | null;
  initialPlatform: string | null;
  totalPages: number;
  totalItems: number;
}

const PAGE_SIZE = 20;

// Memoize pour éviter les re-renders inutiles
export const ContentPageClient = memo(function ContentPageClient({
  initialContents,
  stats,
  initialPage,
  initialQuery,
  initialStatus,
  initialPlatform,
  totalPages,
  totalItems,
}: ContentPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [contents, setContents] = useState(initialContents);
  const [selectedContent, setSelectedContent] = useState<GeneratedContentWithRelations | null>(
    null,
  );
  const [isApproving, setIsApproving] = useState(false);

  // Read current URL params, falling back to initial server-provided values
  const currentPage = Math.max(1, Number(searchParams.get("page") || initialPage));
  const currentQuery = searchParams.get("q") ?? initialQuery;
  const currentStatus = searchParams.get("status") ?? initialStatus ?? "";
  const currentPlatform = searchParams.get("platform") ?? initialPlatform ?? "";

  /**
   * Update URL search params without losing existing params.
   * Navigates to trigger server-side re-fetch.
   */
  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [searchParams, pathname, router],
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      updateSearchParams({ q: query || null, page: null });
    },
    [updateSearchParams],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateSearchParams({ page: String(page) });
    },
    [updateSearchParams],
  );

  const handleApprove = async (id: string) => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/content/${id}/approve`, {
        method: "POST",
      });

      if (response.ok) {
        setContents(contents.map((c) => (c.id === id ? { ...c, status: "APPROVED" } : c)));
        setSelectedContent(null);
      }
    } catch (error) {
      logger.error({ err: error }, "Error approving");
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
        setContents(contents.map((c) => (c.id === id ? { ...c, status: "REJECTED" } : c)));
        setSelectedContent(null);
      }
    } catch (error) {
      logger.error({ err: error }, "Error rejecting");
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
                count > 0 ? "bg-surface-strong" : "bg-surface-strong/50 opacity-50",
              )}
            >
              <span className="text-caption text-muted">{label}:</span>
              <span className="text-body-strong text-ink">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Search Bar — navigates on change (server-side search) */}
      <SearchBar
        value={currentQuery}
        onChange={handleSearchChange}
        placeholder="Search content by text or hashtags..."
        className="max-w-md"
      />

      {/* Content List */}
      <ContentList
        contents={contents}
        searchQuery={currentQuery}
        statusFilter={(currentStatus as ContentStatus) || null}
        platformFilter={(currentPlatform as Platform) || null}
        onApprove={(id) => {
          const content = contents.find((c) => c.id === id);
          if (content) setSelectedContent(content);
        }}
        onReject={handleReject}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
        />
      )}

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
ContentPageClient.displayName = "ContentPageClient";
