"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CGU_TEXT = `TERMS OF SERVICE ACCEPTANCE

By checking the box below and using SocialCreator, you agree to:

1. OWNERSHIP: You confirm that you are the rightful owner or have explicit authorization to manage all social media accounts you connect to SocialCreator.

2. PLATFORM COMPLIANCE: You agree to comply with the Terms of Service and Community Guidelines of every platform you publish on (Instagram, TikTok, YouTube, Facebook, X, LinkedIn, Threads, Pinterest).

3. CONTENT LIMITS: You acknowledge that all platforms enforce posting limits (max 4 posts/day/account by default, configurable up to 8). SocialCreator enforces these limits server-side.

4. NO AUTOMATED ENGAGEMENT: You agree not to use SocialCreator for automated likes, follows, comments, or direct messages. This violates all platform terms of service.

5. CONTENT ORIGINALITY: You confirm that all content generated and published through SocialCreator is original or properly attributed, and does not infringe on third-party rights.

6. LIABILITY: You release SocialCreator from any liability arising from content published through the platform. You are solely responsible for your published content.

7. AUDIT LOG: All publications are logged for compliance. Logs are immutable and may be used for dispute resolution.`;

export function CGUConsentForm() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!accepted) {
      setError("You must accept the terms to continue");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/cgu-accept", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accepted: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to accept terms");
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded-md bg-semantic-error/10 border border-semantic-error text-semantic-error text-body-sm">
          {error}
        </div>
      )}

      <div className="border border-hairline-strong rounded-lg bg-surface-card p-4 max-h-64 overflow-y-auto">
        <pre className="whitespace-pre-wrap font-sans text-body-sm text-body font-normal leading-relaxed">
          {CGU_TEXT}
        </pre>
      </div>

      <div className="flex items-start gap-3">
        <input
          id="accept-terms"
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-hairline-strong text-primary focus:ring-primary focus:ring-offset-2"
        />
        <label htmlFor="accept-terms" className="text-body-sm text-body cursor-pointer">
          I confirm that I own the connected accounts and agree to the terms
        </label>
      </div>

      <button
        type="submit"
        disabled={!accepted || isLoading}
        className="w-full h-10 rounded-pill bg-primary text-on-primary font-medium text-button flex items-center justify-center hover:bg-primary-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Accepting..." : "Accept and Continue"}
      </button>
    </form>
  );
}