import type { Profile, Platform, ContentStatus } from "@prisma/client";

export type ProfileWithStats = Profile & {
  _count: {
    agents: number;
    generatedContents: number;
    connectedAccounts: number;
  };
};

export type ProfileFormData = {
  name: string;
  brandVoice?: string;
  contentBank?: string;
  platforms?: Platform[] | string[];
};

export const PLATFORMS: { value: Platform; label: string; icon: string }[] = [
  { value: "TIKTOK", label: "TikTok", icon: "🎵" },
  { value: "INSTAGRAM", label: "Instagram", icon: "📷" },
  { value: "YOUTUBE", label: "YouTube", icon: "🎬" },
  { value: "FACEBOOK", label: "Facebook", icon: "👥" },
  { value: "X", label: "X (Twitter)", icon: "𝕏" },
  { value: "LINKEDIN", label: "LinkedIn", icon: "💼" },
  { value: "THREADS", label: "Threads", icon: "🧵" },
  { value: "PINTEREST", label: "Pinterest", icon: "📌" },
];

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  FAILED: "Failed",
  REJECTED: "Rejected",
};

export const CONTENT_STATUS_COLORS: Record<ContentStatus, string> = {
  DRAFT: "bg-muted-soft text-ink",
  APPROVED: "bg-gradient-mint text-ink",
  PUBLISHED: "bg-semantic-success/10 text-semantic-success",
  FAILED: "bg-semantic-error/10 text-semantic-error",
  REJECTED: "bg-semantic-error/10 text-semantic-error",
};