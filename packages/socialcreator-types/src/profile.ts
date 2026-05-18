import type { Profile, Platform, ContentStatus } from "@prisma/client";

export type ProfileWithStats = Profile & {
  _count: { agents: number; generatedContents: number; connectedAccounts: number };
};

export type ProfileFormData = {
  name: string;
  brandVoice?: string;
  contentBank?: string;
  platforms?: Platform[] | string[];
};

export const PLATFORMS: { value: Platform; label: string; icon: string }[] = [
  { value: "TIKTOK", label: "TikTok", icon: "TikTok" },
  { value: "INSTAGRAM", label: "Instagram", icon: "Instagram" },
  { value: "YOUTUBE", label: "YouTube", icon: "YouTube" },
  { value: "FACEBOOK", label: "Facebook", icon: "Facebook" },
  { value: "X", label: "X (Twitter)", icon: "X" },
  { value: "LINKEDIN", label: "LinkedIn", icon: "LinkedIn" },
  { value: "THREADS", label: "Threads", icon: "Threads" },
  { value: "PINTEREST", label: "Pinterest", icon: "Pinterest" },
];

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  FAILED: "Failed",
  REJECTED: "Rejected",
  SCHEDULED: "Scheduled",
};

export const CONTENT_STATUS_COLORS: Record<ContentStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  APPROVED: "bg-green-100 text-green-800",
  PUBLISHED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  REJECTED: "bg-red-100 text-red-800",
  SCHEDULED: "bg-blue-100 text-blue-800",
};