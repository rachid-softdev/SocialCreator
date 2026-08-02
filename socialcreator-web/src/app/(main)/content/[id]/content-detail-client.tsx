"use client";

import type { GeneratedContentWithRelations } from "@socialcreator/types/agent";
import { formatDateTime } from "@socialcreator/utils";
import { ArrowLeft, Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ContentEditor } from "@/components/content/content-editor";
import { ContentStatusBadge } from "@/components/content/content-status-badge";
import { PlatformBadge } from "@/components/content/platform-badge";
import { PublishButton } from "@/components/content/publish-button";
import { SchedulePanel } from "@/components/content/schedule-panel";
import { Breadcrumb } from "@/components/layout/breadcrumb";

interface ContentDetailClientProps {
  content: GeneratedContentWithRelations;
}

export function ContentDetailClient({ content }: ContentDetailClientProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const isDraft = content.status === "DRAFT";
  const isApproved = content.status === "APPROVED";
  const isPublished = content.status === "PUBLISHED";
  const isScheduled = content.status === "SCHEDULED";
  const isFailed = content.status === "FAILED";

  const handleSave = async (data: { textContent: string; hashtags: string[] }) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/content/${content.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        router.refresh();
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Error saving", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/content/${content.id}/approve`, {
        method: "POST",
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Error approving", error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/content/${content.id}/reject`, {
        method: "POST",
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Error rejecting", error);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Content", href: "/content" },
          { label: `${content.platform} - ${content.id.slice(-6)}` },
        ]}
      />

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <PlatformBadge platform={content.platform} />
            <ContentStatusBadge status={content.status} />
          </div>
          <p className="text-body-sm text-muted">
            Created {formatDateTime(content.createdAt)}
            {content.profile && ` · ${content.profile.name}`}
          </p>
        </div>

        <Link
          href="/content"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-pill text-button text-muted hover:bg-surface-strong transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      {isEditing ? (
        <div className="bg-surface-card rounded-xl border border-hairline p-6">
          <ContentEditor
            content={content}
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
            isSaving={isSaving}
          />
        </div>
      ) : (
        <>
          {/* Content Preview */}
          <div className="bg-surface-card rounded-xl border border-hairline p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-title-sm text-ink">Content</h2>
              {isDraft && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-body-sm text-muted hover:text-ink transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            <div className="prose prose-sm max-w-none">
              <p className="text-body-md text-ink whitespace-pre-wrap">{content.textContent}</p>
            </div>

            {content.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-hairline">
                {content.hashtags.map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-pill bg-surface-strong text-caption">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          {isDraft && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="inline-flex items-center gap-2 px-6 py-2 rounded-pill bg-semantic-success text-white text-button hover:bg-semantic-success/90 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isApproving}
                className="inline-flex items-center gap-2 px-6 py-2 rounded-pill bg-semantic-error text-white text-button hover:bg-semantic-error/90 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </div>
          )}

          {isApproved && (
            <div className="flex items-start gap-3">
              <PublishButton
                contentId={content.id}
                profileId={content.profile?.id || ""}
                platform={content.platform}
              />
              <SchedulePanel
                contentId={content.id}
                initialSchedule={{
                  scheduledPublishAt: content.scheduledPublishAt ?? undefined,
                  scheduledTimezone: content.scheduledTimezone ?? undefined,
                }}
                onScheduled={() => router.refresh()}
              />
            </div>
          )}

          {/* Published content info */}
          {isPublished && (
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-semantic-success/10 text-semantic-success text-button">
                <Check className="w-4 h-4" />
                Published
              </div>
              {content.postId && (
                <div className="text-body-sm text-muted">Post ID: {content.postId}</div>
              )}
            </div>
          )}

          {/* Scheduled content info */}
          {isScheduled && (
            <SchedulePanel
              contentId={content.id}
              initialSchedule={{
                scheduledPublishAt: content.scheduledPublishAt ?? undefined,
                scheduledTimezone: content.scheduledTimezone ?? undefined,
              }}
              onScheduled={() => router.refresh()}
            />
          )}

          {/* Failed content info */}
          {isFailed && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-semantic-error/10 text-semantic-error text-button">
              <X className="w-4 h-4" />
              Publication failed
            </div>
          )}

          {/* Metadata */}
          <div className="bg-surface-card rounded-xl border border-hairline p-6">
            <h3 className="text-title-sm text-ink mb-4">Details</h3>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-caption text-muted">Platform</dt>
                <dd className="text-body-sm text-ink mt-1">
                  <PlatformBadge platform={content.platform} size="sm" />
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted">Characters</dt>
                <dd className="text-body-sm text-ink mt-1">{content.textContent.length}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted">Hashtags</dt>
                <dd className="text-body-sm text-ink mt-1">{content.hashtags.length}</dd>
              </div>
              {content.run?.agent && (
                <div>
                  <dt className="text-caption text-muted">Generated by</dt>
                  <dd className="text-body-sm text-ink mt-1">{content.run.agent.name}</dd>
                </div>
              )}
              {content.profile && (
                <div>
                  <dt className="text-caption text-muted">Profile</dt>
                  <dd className="text-body-sm text-ink mt-1">{content.profile.name}</dd>
                </div>
              )}
            </dl>
          </div>
        </>
      )}
    </div>
  );
}
