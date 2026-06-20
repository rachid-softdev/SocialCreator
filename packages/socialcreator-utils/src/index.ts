import { createHash } from "node:crypto";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function startOfDayUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return "<1s";
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}min`;
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function computeContentHash(params: {
  profileId: string;
  platform: string;
  textContent: string;
  mediaUrls: string[];
  hashtags: string[];
}): string {
  const canonical = [
    params.profileId,
    params.platform,
    params.textContent,
    [...params.mediaUrls].sort().join(","),
    [...params.hashtags].sort().join(","),
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}
