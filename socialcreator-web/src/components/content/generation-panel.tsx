"use client";

import { PLATFORMS } from "@socialcreator/types/profile";
import { Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { GeneratedContentResult } from "./generation-result";
import { GenerationResult } from "./generation-result";

// ── Types ──────────────────────────────────────────────────────

interface ProfileOption {
  id: string;
  name: string;
}

interface GenerationError {
  message: string;
  code?: string;
}

// ── Component ───────────────────────────────────────────────────

export function GenerationPanel() {
  // Profile state
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profilesLoading, setProfilesLoading] = useState(true);

  // Form state
  const [platform, setPlatform] = useState("");
  const [brief, setBrief] = useState("");
  const [count, setCount] = useState(1);
  const [keywords, setKeywords] = useState("");
  const [brandVoice, setBrandVoice] = useState("");

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedContentResult[]>([]);
  const [error, setError] = useState<GenerationError | null>(null);

  // Fetch profiles on mount
  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await fetch("/api/v1/profiles");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.profiles ?? data.data ?? []);
          setProfiles(list);
          if (list.length > 0) {
            setSelectedProfileId(list[0].id);
          }
        }
      } catch {
        // Silently fail — user will see empty selector
      } finally {
        setProfilesLoading(false);
      }
    }
    fetchProfiles();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (brief.length < 10 || !platform || !selectedProfileId) return;

    setGenerating(true);
    setError(null);
    setResults([]);

    try {
      const keywordsArr = keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await fetch("/api/v1/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: selectedProfileId,
          platform,
          brief,
          count,
          keywords: keywordsArr.length > 0 ? keywordsArr : undefined,
          brandVoice: brandVoice.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError({
          message: data.error || "Failed to generate content",
          code: data.code,
        });
        return;
      }

      setResults(data.contents ?? []);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "An unexpected error occurred",
      });
    } finally {
      setGenerating(false);
    }
  }, [brief, platform, selectedProfileId, count, keywords, brandVoice]);

  const isGenerateDisabled = generating || brief.length < 10 || !platform || !selectedProfileId;

  return (
    <div className="space-y-8">
      {/* Generation Form */}
      <div className="bg-surface-card border border-hairline rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-title-sm text-ink">Generate Content</h2>
        </div>

        {/* Profile Selector */}
        <div>
          <label className="block text-body-sm text-ink mb-1.5">Profile</label>
          {profilesLoading ? (
            <div className="flex items-center gap-2 text-caption text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading profiles...
            </div>
          ) : (
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-surface-card border border-hairline-strong text-body-md text-ink focus:outline-none focus:border-primary"
            >
              {profiles.length === 0 && <option value="">No profiles available</option>}
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Platform Selector */}
        <div>
          <label className="block text-body-sm text-ink mb-1.5">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-surface-card border border-hairline-strong text-body-md text-ink focus:outline-none focus:border-primary"
          >
            <option value="">Select a platform...</option>
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.icon} {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Count Selector */}
        <div>
          <label className="block text-body-sm text-ink mb-1.5">Variations to generate</label>
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={`w-10 h-10 rounded-lg text-body-sm font-medium transition-colors ${
                  count === n
                    ? "bg-primary text-on-primary"
                    : "bg-surface-strong text-muted hover:text-ink"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Brief Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-body-sm text-ink">Brief</label>
            <span
              className={`text-caption ${brief.length < 10 ? "text-semantic-error" : "text-muted"}`}
            >
              {brief.length}/2000
            </span>
          </div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe what you want to generate..."
            rows={4}
            className="w-full px-4 py-3 rounded-lg bg-surface-card border border-hairline-strong text-body-md text-ink resize-none focus:outline-none focus:border-primary placeholder:text-muted-soft"
          />
          {brief.length > 0 && brief.length < 10 && (
            <p className="text-caption text-semantic-error mt-1">
              Brief must be at least 10 characters
            </p>
          )}
        </div>

        {/* Keywords */}
        <div>
          <label className="block text-body-sm text-ink mb-1.5">
            Keywords <span className="text-muted">(comma-separated, optional)</span>
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g., AI, technology, innovation"
            className="w-full px-4 py-2.5 rounded-lg bg-surface-card border border-hairline-strong text-body-md text-ink focus:outline-none focus:border-primary placeholder:text-muted-soft"
          />
        </div>

        {/* Brand Voice */}
        <div>
          <label className="block text-body-sm text-ink mb-1.5">
            Brand Voice <span className="text-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={brandVoice}
            onChange={(e) => setBrandVoice(e.target.value)}
            placeholder="e.g., Professional and authoritative"
            className="w-full px-4 py-2.5 rounded-lg bg-surface-card border border-hairline-strong text-body-md text-ink focus:outline-none focus:border-primary placeholder:text-muted-soft"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-semantic-error/10 border border-semantic-error/20">
            <X className="w-4 h-4 text-semantic-error mt-0.5 shrink-0" />
            <div>
              <p className="text-body-sm text-semantic-error">{error.message}</p>
              {error.code === "LIMIT_REACHED" && (
                <p className="text-caption text-muted mt-1">
                  Upgrade your plan to increase your daily generation limit.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerateDisabled}
          className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-title-sm text-ink">
            Generated Content ({results.length} {results.length === 1 ? "item" : "items"})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((content) => (
              <GenerationResult key={content.id} content={content} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
