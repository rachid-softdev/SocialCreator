"use client";

import type { Platform } from "@prisma/client";
import type { ProfileFormData } from "@socialcreator/types/profile";
import { PLATFORMS } from "@socialcreator/types/profile";
import { TextInput } from "@socialcreator/ui/text-input";
import { cn } from "@socialcreator/utils";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandVoiceEditor } from "./brand-voice-editor";
import { ContentBankEditor } from "./content-bank-editor";

interface ProfileFormProps {
  initialData?: ProfileFormData & { id?: string };
  onSubmit: (data: ProfileFormData) => Promise<void>;
  isLoading?: boolean;
}

export function ProfileForm({ initialData, onSubmit, isLoading = false }: ProfileFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<ProfileFormData>({
    name: "",
    brandVoice: "",
    contentBank: "",
    platforms: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync initial data with state
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        brandVoice: initialData.brandVoice || "",
        contentBank: initialData.contentBank || "",
        platforms: initialData.platforms || [],
      });
    }
  }, [initialData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    } else if (formData.name.length > 50) {
      newErrors.name = "Name must be less than 50 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error("Error submitting form", error);
      setErrors({ submit: "Failed to save profile. Please try again." });
    }
  };

  const togglePlatform = (platform: Platform) => {
    setFormData((prev) => ({
      ...prev,
      platforms: prev.platforms?.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...(prev.platforms || []), platform],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Name */}
      <div className="space-y-2">
        <label htmlFor="name" className="block text-body-sm text-body">
          Profile Name <span className="text-semantic-error">*</span>
        </label>
        <TextInput
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="My Brand"
          error={!!errors.name}
          className="max-w-md"
        />
        {errors.name && <p className="text-caption text-semantic-error">{errors.name}</p>}
      </div>

      {/* Brand Voice */}
      <BrandVoiceEditor
        value={formData.brandVoice || ""}
        onChange={(value) => setFormData((prev) => ({ ...prev, brandVoice: value }))}
      />

      {/* Content Bank */}
      <ContentBankEditor
        value={formData.contentBank || ""}
        onChange={(value) => setFormData((prev) => ({ ...prev, contentBank: value }))}
      />

      {/* Platforms */}
      <div className="space-y-3">
        <span className="block text-body-sm text-body">Platforms</span>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((platform) => (
            <button
              key={platform.value}
              type="button"
              onClick={() => togglePlatform(platform.value)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-pill border text-body-sm transition-all",
                formData.platforms?.includes(platform.value)
                  ? "bg-ink text-on-primary border-ink"
                  : "bg-surface-card text-muted border-hairline-strong hover:border-ink",
              )}
            >
              <span>{platform.icon}</span>
              {platform.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error message */}
      {errors.submit && (
        <div className="p-3 rounded-md bg-semantic-error/10 border border-semantic-error text-semantic-error text-body-sm">
          {errors.submit}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-pill bg-primary text-on-primary font-medium text-button",
            "hover:bg-primary-active transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {initialData?.id ? "Update Profile" : "Create Profile"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 rounded-pill border border-hairline-strong text-body-strong text-ink hover:bg-surface-strong transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
