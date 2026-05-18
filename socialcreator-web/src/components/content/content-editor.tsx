"use client";

import { useState } from "react";
import { X, Save, Hash, Eye } from "lucide-react";
import { cn } from "@socialcreator/utils";
import { MultiPlatformPreview } from "./platform-preview";
import type { GeneratedContentWithRelations } from "@socialcreator/types/agent";
import type { Platform } from "@prisma/client";
import { PLATFORM_CONSTRAINTS } from "@socialcreator/types/agent";
import { PLATFORMS } from "@socialcreator/types/profile";

interface ContentEditorProps {
  content: GeneratedContentWithRelations;
  onSave: (data: { textContent: string; hashtags: string[] }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function ContentEditor({ content, onSave, onCancel, isSaving }: ContentEditorProps) {
  const [textContent, setTextContent] = useState(content.textContent);
  const [hashtags, setHashtags] = useState<string[]>(content.hashtags);
  const [newHashtag, setNewHashtag] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const constraints = PLATFORM_CONSTRAINTS[content.platform];

  const handleAddHashtag = () => {
    const tag = newHashtag.trim().replace(/^#/, "");
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
      setNewHashtag("");
    }
  };

  const handleRemoveHashtag = (tag: string) => {
    setHashtags(hashtags.filter((t) => t !== tag));
  };

  const handleSave = () => {
    onSave({ textContent, hashtags });
  };

  const isOverLimit = textContent.length > constraints.maxChars;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{PLATFORMS.find((p) => p.value === content.platform)?.icon}</span>
          <div>
            <h2 className="text-title-sm text-ink">Edit Content</h2>
            <p className="text-caption text-muted">{PLATFORMS.find((p) => p.value === content.platform)?.label}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-2 rounded-lg hover:bg-surface-strong text-muted"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Text Editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-body-sm text-ink">Content</label>
          <span className={cn("text-caption", isOverLimit ? "text-semantic-error" : "text-muted")}>
            {textContent.length}/{constraints.maxChars}
          </span>
        </div>
        <textarea
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          className={cn(
            "w-full px-4 py-3 rounded-lg bg-surface-card border text-body-md text-ink resize-none focus:outline-none focus:ring-1",
            isOverLimit ? "border-semantic-error focus:border-semantic-error" : "border-hairline-strong focus:border-primary"
          )}
          rows={8}
        />
        {isOverLimit && (
          <p className="text-caption text-semantic-error mt-1">
            Content exceeds platform limit by {textContent.length - constraints.maxChars} characters
          </p>
        )}
      </div>

      {/* Hashtags */}
      <div>
        <label className="text-body-sm text-ink mb-2 block">Hashtags</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {hashtags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-surface-strong text-caption"
            >
              #{tag}
              <button
                onClick={() => handleRemoveHashtag(tag)}
                className="hover:text-semantic-error"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newHashtag}
            onChange={(e) => setNewHashtag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddHashtag()}
            placeholder="Add hashtag..."
            className="flex-1 px-4 py-2 rounded-md bg-surface-card border border-hairline-strong text-body-md text-ink placeholder:text-muted-soft focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleAddHashtag}
            className="px-4 py-2 rounded-md bg-surface-strong text-body-sm text-ink hover:bg-hairline transition-colors"
          >
            <Hash className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview Toggle */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        className="flex items-center gap-2 text-body-sm text-muted hover:text-ink transition-colors"
      >
        <Eye className="w-4 h-4" />
        {showPreview ? "Hide Preview" : "Show Preview"}
      </button>

      {/* Preview */}
      {showPreview && (
        <div className="bg-surface-soft rounded-xl p-6">
          <MultiPlatformPreview
            content={textContent}
            hashtags={hashtags}
            platforms={[content.platform as Platform]}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-hairline">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-pill text-body-sm text-muted hover:bg-surface-strong transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || isOverLimit}
          className="flex items-center gap-2 px-6 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
