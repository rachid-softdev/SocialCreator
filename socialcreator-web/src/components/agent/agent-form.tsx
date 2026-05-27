"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@socialcreator/utils";
import { PLATFORMS } from "@socialcreator/types/profile";
import type { AgentType, Platform } from "@prisma/client";
import { AGENT_TYPE_LABELS, AGENT_TYPE_DESCRIPTIONS } from "@socialcreator/types/agent";
import { Bot, Type, Video, RefreshCw } from "lucide-react";

interface AgentFormProps {
  profileId: string;
  initialData?: {
    name?: string;
    type?: AgentType;
    platforms?: Platform[];
    scheduleCron?: string | null;
    autoPublish?: boolean;
    maxPerDay?: number;
  };
  isEdit?: boolean;
  agentId?: string;
}

const AGENT_TYPES: { value: AgentType; icon: typeof Bot; label: string }[] = [
  { value: "TEXT_POST", icon: Type, label: AGENT_TYPE_LABELS.TEXT_POST },
  { value: "VIDEO_CLIP", icon: Video, label: AGENT_TYPE_LABELS.VIDEO_CLIP },
  { value: "CROSS_POST", icon: RefreshCw, label: AGENT_TYPE_LABELS.CROSS_POST },
];

export function AgentForm({ profileId, initialData, isEdit, agentId }: AgentFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    type: initialData?.type || ("TEXT_POST" as AgentType),
    platforms: initialData?.platforms || ([] as Platform[]),
    scheduleCron: initialData?.scheduleCron || "",
    autoPublish: initialData?.autoPublish || false,
    maxPerDay: initialData?.maxPerDay || 2,
  });

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    if (formData.platforms.length === 0) {
      setError("At least one platform is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEdit ? `/api/agents/${agentId}` : "/api/agents";
      const method = isEdit ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          name: formData.name,
          type: formData.type,
          platforms: formData.platforms,
          scheduleCron: formData.scheduleCron || null,
          autoPublish: formData.autoPublish,
          maxPerDay: formData.maxPerDay,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save agent");
      }

      router.push(`/profiles/${profileId}/agents`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePlatform = (platform: Platform) => {
    setFormData((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  return (
    <div className="space-y-8">
      {/* Steps indicator */}
      {!isEdit && (
        <div className="flex items-center gap-4">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-button",
                  step >= s ? "bg-primary text-on-primary" : "bg-surface-strong text-muted",
                )}
              >
                {s}
              </div>
              <span className={cn("text-body-sm", step >= s ? "text-ink" : "text-muted")}>
                {s === 1 ? "Basic Info" : "Platforms & Schedule"}
              </span>
              {s < 2 && <div className="w-8 h-px bg-hairline mx-2" />}
            </div>
          ))}
        </div>
      )}

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-body-sm text-ink mb-2">Agent Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Daily Inspiration Bot"
              className="w-full px-4 py-3 rounded-md bg-surface-card border border-hairline-strong text-body-md text-ink placeholder:text-muted-soft focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-body-sm text-ink mb-3">Agent Type</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {AGENT_TYPES.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setFormData((prev) => ({ ...prev, type: value }))}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all",
                    formData.type === value
                      ? "border-primary bg-primary/5"
                      : "border-hairline hover:border-hairline-strong",
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="w-5 h-5 text-body" />
                    <span className="text-body-strong text-ink">{label}</span>
                  </div>
                  <p className="text-caption text-muted">{AGENT_TYPE_DESCRIPTIONS[value]}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Platforms & Schedule */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Platforms */}
          <div>
            <label className="block text-body-sm text-ink mb-3">
              Target Platforms
              <span className="text-muted ml-2">(select at least one)</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map(({ value, icon, label }) => (
                <button
                  key={value}
                  onClick={() => togglePlatform(value as Platform)}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-pill border transition-all",
                    formData.platforms.includes(value as Platform)
                      ? "bg-primary text-on-primary border-primary"
                      : "bg-surface-card border-hairline hover:border-hairline-strong text-ink",
                  )}
                >
                  <span>{icon}</span>
                  <span className="text-body-sm">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-body-sm text-ink mb-2">
              Schedule (Cron Expression)
              <span className="text-muted ml-2">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.scheduleCron}
              onChange={(e) => setFormData((prev) => ({ ...prev, scheduleCron: e.target.value }))}
              placeholder="e.g., 0 9 * * * (daily at 9am)"
              className="w-full px-4 py-3 rounded-md bg-surface-card border border-hairline-strong text-body-md text-ink placeholder:text-muted-soft focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-caption text-muted mt-1">
              Leave empty for manual runs only. Format: minute hour day month weekday
            </p>
          </div>

          {/* Auto Publish Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-surface-strong">
            <div>
              <p className="text-body-strong text-ink">Auto-publish</p>
              <p className="text-caption text-muted">Automatically approve generated content</p>
            </div>
            <button
              onClick={() => setFormData((prev) => ({ ...prev, autoPublish: !prev.autoPublish }))}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative",
                formData.autoPublish ? "bg-primary" : "bg-muted-soft",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  formData.autoPublish ? "left-7" : "left-1",
                )}
              />
            </button>
          </div>

          {/* Max Per Day */}
          <div>
            <label className="block text-body-sm text-ink mb-2">
              Max runs per day: {formData.maxPerDay}
            </label>
            <input
              type="range"
              min="1"
              max="8"
              value={formData.maxPerDay}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, maxPerDay: parseInt(e.target.value) }))
              }
              className="w-full"
            />
            <div className="flex justify-between text-caption text-muted">
              <span>1</span>
              <span>8</span>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-semantic-error/10 border border-semantic-error/20">
          <p className="text-body-sm text-semantic-error">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-hairline">
        {!isEdit && step > 1 && (
          <button
            onClick={() => setStep(1)}
            className="px-4 py-2 rounded-pill text-body-sm text-ink hover:bg-surface-strong transition-colors"
          >
            Back
          </button>
        )}
        <div className="flex-1" />
        {!isEdit ? (
          step < 2 ? (
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Agent"}
            </button>
          )
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>

      {/* Preview Card */}
      {(formData.name || formData.platforms.length > 0) && (
        <div className="mt-8">
          <h4 className="text-body-sm text-muted mb-3">Preview</h4>
          <div className="p-6 rounded-xl bg-surface-card border border-hairline">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-surface-strong flex items-center justify-center">
                <Bot className="w-6 h-6 text-body" />
              </div>
              <div>
                <h5 className="text-body-strong text-ink">{formData.name || "Agent Name"}</h5>
                <p className="text-caption text-muted">{AGENT_TYPE_LABELS[formData.type]}</p>
                {formData.platforms.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.platforms.map((p) => {
                      const platform = PLATFORMS.find((pl) => pl.value === p);
                      return (
                        <span key={p} className="px-2 py-0.5 rounded bg-surface-strong text-xs">
                          {platform?.icon} {platform?.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
