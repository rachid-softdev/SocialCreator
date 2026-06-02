"use client";

import { PLATFORMS } from "@socialcreator/types/profile";
import { Button } from "@socialcreator/ui/button";
import { TextInput } from "@socialcreator/ui/text-input";
import { cn } from "@socialcreator/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

const DEFAULT_PLATFORMS = ["INSTAGRAM", "TIKTOK", "LINKEDIN", "X"];

export function OnboardingProfileForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(DEFAULT_PLATFORMS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name || name.trim().length < 2) {
      setError("Profile name must be at least 2 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brandVoice: "Professional & engaging",
          platforms,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create profile");
        return;
      }

      router.push(`/onboarding/agent?profileId=${data.profile.id}`);
    } catch (_err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="p-3 rounded-md bg-semantic-error/10 border border-semantic-error text-semantic-error text-body-sm"
        >
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="name" className="block text-body-sm text-body">
          Profile Name <span className="text-semantic-error">*</span>
        </label>
        <TextInput
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Brand"
          className="max-w-md"
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="block text-body-sm text-body">Platforms</legend>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((platform) => (
            <button
              key={platform.value}
              type="button"
              onClick={() => togglePlatform(platform.value)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-pill border text-body-sm transition-all",
                platforms.includes(platform.value)
                  ? "bg-ink text-on-primary border-ink"
                  : "bg-surface-card text-muted border-hairline-strong hover:border-ink",
              )}
            >
              <span>{platform.icon}</span>
              {platform.label}
            </button>
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Creating..." : "Continue"}
      </Button>
    </form>
  );
}
