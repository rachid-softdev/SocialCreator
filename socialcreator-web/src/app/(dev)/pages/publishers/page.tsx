import { notFound } from "next/navigation";
import { DevBadge } from "@/components/dev/DevBadge";
import { PagePreview } from "@/components/dev/PagePreview";

const platforms = [
  {
    name: "Instagram",
    key: "INSTAGRAM",
    limits: { maxLength: 2200, maxHashtags: 30, supportsImages: true, supportsVideo: true },
    example:
      "Just shipped a new feature! Check it out and let us know what you think. #buildinpublic #saas #startup",
  },
  {
    name: "X (Twitter)",
    key: "X",
    limits: { maxLength: 280, maxHashtags: 5, supportsImages: true, supportsVideo: true },
    example: "Just shipped a new feature! What do you think? #buildinpublic",
  },
  {
    name: "LinkedIn",
    key: "LINKEDIN",
    limits: { maxLength: 3000, maxHashtags: 30, supportsImages: true, supportsVideo: true },
    example:
      "Excited to announce our latest feature release.\n\nWe've been working hard on this and can't wait for your feedback.\n\n#buildinpublic #productupdate #saas",
  },
  {
    name: "TikTok",
    key: "TIKTOK",
    limits: { maxLength: 2200, maxHashtags: 10, supportsImages: false, supportsVideo: true },
    example: "POV: you just discovered the best feature ever #fyp #viral #tech",
  },
  {
    name: "YouTube",
    key: "YOUTUBE",
    limits: { maxLength: 5000, maxHashtags: 15, supportsImages: false, supportsVideo: true },
    example:
      "In this video we walk through our latest feature release and show you how to get started.\n\n#tutorial #tech #buildinpublic",
  },
  {
    name: "Facebook",
    key: "FACEBOOK",
    limits: { maxLength: 63206, maxHashtags: 30, supportsImages: true, supportsVideo: true },
    example:
      "We're thrilled to share our latest update with you all! Your feedback has been instrumental in shaping this release.",
  },
  {
    name: "Threads",
    key: "THREADS",
    limits: { maxLength: 500, maxHashtags: 10, supportsImages: true, supportsVideo: true },
    example: "Just shipped a new feature! Feedback welcome #buildinpublic",
  },
  {
    name: "Pinterest",
    key: "PINTEREST",
    limits: { maxLength: 500, maxHashtags: 20, supportsImages: true, supportsVideo: false },
    example: "Check out our latest product update - link in bio for the full walkthrough!",
  },
] as const;

const colors: Record<string, string> = {
  INSTAGRAM: "from-pink-500 to-purple-500",
  X: "from-gray-800 to-black",
  LINKEDIN: "from-blue-600 to-blue-700",
  TIKTOK: "from-cyan-400 to-pink-500",
  YOUTUBE: "from-red-500 to-red-600",
  FACEBOOK: "from-blue-500 to-blue-600",
  THREADS: "from-gray-700 to-gray-900",
  PINTEREST: "from-red-400 to-red-600",
};

export default function PublishersSandboxPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-display-md text-ink">Publisher Sandbox</h1>
        <DevBadge />
      </div>

      <p className="text-body-md text-muted mb-8 max-w-2xl">
        Preview how content adapts across all 8 supported platforms. Each card shows character
        limits, media support, and a sample post rendered in platform style.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {platforms.map((platform) => (
          <div
            key={platform.key}
            className="rounded-xl border border-hairline bg-surface-card overflow-hidden"
          >
            <div className={`bg-gradient-to-r ${colors[platform.key]} px-5 py-3`}>
              <h2 className="text-button text-white font-medium">{platform.name}</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-caption">
                <div>
                  <span className="text-muted block">Max length</span>
                  <span className="text-body-strong">
                    {platform.limits.maxLength.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted block">Max hashtags</span>
                  <span className="text-body-strong">{platform.limits.maxHashtags}</span>
                </div>
                <div>
                  <span className="text-muted block">Images</span>
                  <span className="text-body-strong">
                    {platform.limits.supportsImages ? "Yes" : "No"}
                  </span>
                </div>
                <div>
                  <span className="text-muted block">Video</span>
                  <span className="text-body-strong">
                    {platform.limits.supportsVideo ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              <div className="border-t border-hairline pt-4">
                <span className="text-caption-uppercase text-muted block mb-2">Example</span>
                <div className="rounded-lg bg-canvas-soft p-3">
                  <p className="text-body-sm text-ink whitespace-pre-wrap">{platform.example}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
