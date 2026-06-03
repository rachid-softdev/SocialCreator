/**
 * Conflict Detector
 *
 * Checks for scheduling conflicts before publishing:
 * - Time conflicts (overlapping scheduled items within a time window)
 * - Daily caps (maximum publishes per day per platform)
 */

import type { Platform } from "@prisma/client";
import { getRepositories } from "@/lib/repositories";

export interface ConflictWarning {
  type: "time_conflict" | "daily_cap";
  message: string;
  conflictingIds?: string[];
  currentCount?: number;
  maxCount?: number;
}

export interface ConflictResult {
  hasWarning: boolean;
  warnings: ConflictWarning[];
}

export async function checkScheduleConflicts(
  profileId: string,
  platform: Platform,
  scheduledPublishAt: Date,
  options?: {
    timeWindowMinutes?: number;
    maxPerDay?: number;
  },
): Promise<ConflictResult> {
  const warnings: ConflictWarning[] = [];
  const windowMin = options?.timeWindowMinutes ?? 5;
  const maxPerDay = options?.maxPerDay ?? 50;

  const { content: contentRepo, publishLog: publishLogRepo } = getRepositories();

  // Check time conflicts
  const start = new Date(scheduledPublishAt.getTime() - windowMin * 60 * 1000);
  const end = new Date(scheduledPublishAt.getTime() + windowMin * 60 * 1000);
  const conflicting = await contentRepo.findScheduledByProfileAndTime(profileId, start, end);

  if (conflicting.length > 0) {
    warnings.push({
      type: "time_conflict",
      message: `There ${conflicting.length === 1 ? "is" : "are"} ${conflicting.length} other item${conflicting.length === 1 ? "" : "s"} scheduled within ${windowMin} minutes of this time`,
      conflictingIds: conflicting.map((c) => c.id),
    });
  }

  // Check daily cap
  const todayCount = await publishLogRepo.countPublishedToday(profileId, platform);
  if (todayCount >= maxPerDay) {
    warnings.push({
      type: "daily_cap",
      message: `Daily publish cap reached (${todayCount}/${maxPerDay})`,
      currentCount: todayCount,
      maxCount: maxPerDay,
    });
  }

  return {
    hasWarning: warnings.length > 0,
    warnings,
  };
}
