import type { Profile, ContentStatus } from "@prisma/client";
import type { Platform } from "./platforms";
import { PLATFORM_DISPLAY } from "./platforms";

export type ProfileWithStats = Profile & {
  _count: { agents: number; generatedContents: number; connectedAccounts: number };
};

export type ProfileFormData = {
  name: string;
  brandVoice?: string;
  contentBank?: string;
  platforms?: Platform[] | string[];
};

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

export { PLATFORM_DISPLAY as PLATFORMS };
