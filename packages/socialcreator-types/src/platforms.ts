import { z } from "zod";

// Single source of truth
export const PLATFORMS = [
  "TIKTOK",
  "INSTAGRAM",
  "YOUTUBE",
  "FACEBOOK",
  "X",
  "LINKEDIN",
  "THREADS",
  "PINTEREST",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const platformSchema = z.enum(PLATFORMS);
export const platformsArraySchema = z.array(platformSchema);

// Display metadata
export interface PlatformDisplay {
  value: Platform;
  label: string;
  icon: string;
}

export const PLATFORM_DISPLAY: PlatformDisplay[] = [
  { value: "TIKTOK", label: "TikTok", icon: "TikTok" },
  { value: "INSTAGRAM", label: "Instagram", icon: "Instagram" },
  { value: "YOUTUBE", label: "YouTube", icon: "YouTube" },
  { value: "FACEBOOK", label: "Facebook", icon: "Facebook" },
  { value: "X", label: "X (Twitter)", icon: "X" },
  { value: "LINKEDIN", label: "LinkedIn", icon: "LinkedIn" },
  { value: "THREADS", label: "Threads", icon: "Threads" },
  { value: "PINTEREST", label: "Pinterest", icon: "Pinterest" },
];

// Platform constraints
export interface PlatformConstraint {
  maxChars: number;
  maxHashtags: number;
  supportsVideo: boolean;
  supportsImages: boolean;
}

export const PLATFORM_CONSTRAINTS: Record<Platform, PlatformConstraint> = {
  INSTAGRAM: { maxChars: 2200, maxHashtags: 30, supportsVideo: true, supportsImages: true },
  TIKTOK: { maxChars: 150, maxHashtags: 10, supportsVideo: true, supportsImages: false },
  LINKEDIN: { maxChars: 3000, maxHashtags: 5, supportsVideo: true, supportsImages: true },
  YOUTUBE: { maxChars: 5000, maxHashtags: 15, supportsVideo: true, supportsImages: false },
  X: { maxChars: 280, maxHashtags: 3, supportsVideo: true, supportsImages: true },
  FACEBOOK: { maxChars: 63206, maxHashtags: 10, supportsVideo: true, supportsImages: true },
  THREADS: { maxChars: 500, maxHashtags: 10, supportsVideo: true, supportsImages: true },
  PINTEREST: { maxChars: 500, maxHashtags: 20, supportsVideo: false, supportsImages: true },
};
