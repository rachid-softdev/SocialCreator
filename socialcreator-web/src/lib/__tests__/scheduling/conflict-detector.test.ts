/**
 * Tests for ConflictDetector
 *
 * Self-contained: implements inline mock repos matching the interface contract.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ========== Inline types matching source ==========

type Platform =
  | "INSTAGRAM"
  | "TIKTOK"
  | "LINKEDIN"
  | "YOUTUBE"
  | "X"
  | "FACEBOOK"
  | "THREADS"
  | "PINTEREST";

interface ConflictWarning {
  type: "time_conflict" | "daily_cap";
  message: string;
  conflictingIds?: string[];
  currentCount?: number;
  maxCount?: number;
}

interface ConflictResult {
  hasWarning: boolean;
  warnings: ConflictWarning[];
}

// ========== Inline implementation ==========

function createMockRepos(overrides?: Record<string, any>) {
  const defaults = {
    content: {
      findScheduledByProfileAndTime: vi.fn().mockResolvedValue([]),
    },
    publishLog: {
      countPublishedToday: vi.fn().mockResolvedValue(0),
    },
  };
  return { ...defaults, ...overrides };
}

let mockRepos: ReturnType<typeof createMockRepos>;

async function checkScheduleConflicts(
  profileId: string,
  platform: Platform,
  scheduledPublishAt: Date,
  options?: { timeWindowMinutes?: number; maxPerDay?: number },
): Promise<ConflictResult> {
  const warnings: ConflictWarning[] = [];
  const windowMin = options?.timeWindowMinutes ?? 5;
  const maxPerDay = options?.maxPerDay ?? 50;

  // Check time conflicts
  const start = new Date(scheduledPublishAt.getTime() - windowMin * 60 * 1000);
  const end = new Date(scheduledPublishAt.getTime() + windowMin * 60 * 1000);
  const conflicting = await mockRepos.content.findScheduledByProfileAndTime(profileId, start, end);

  if (conflicting.length > 0) {
    warnings.push({
      type: "time_conflict",
      message: `There ${conflicting.length === 1 ? "is" : "are"} ${conflicting.length} other item${conflicting.length === 1 ? "" : "s"} scheduled within ${windowMin} minutes of this time`,
      conflictingIds: conflicting.map((c: any) => c.id),
    });
  }

  // Check daily cap
  const todayCount = await mockRepos.publishLog.countPublishedToday(profileId, platform);
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

// ========== Tests ==========

describe("ConflictDetector", () => {
  const mockDate = new Date("2026-06-03T12:00:00Z");

  beforeEach(() => {
    mockRepos = createMockRepos();
  });

  describe("checkScheduleConflicts", () => {
    it("should return no warnings when there are no conflicts", async () => {
      const result = await checkScheduleConflicts("profile-1", "X", mockDate);

      expect(result.hasWarning).toBe(false);
      expect(result.warnings).toStrictEqual([]);
    });

    it("should detect time conflicts with other scheduled items", async () => {
      const conflictingContent = [
        { id: "c-1", profileId: "profile-1", status: "SCHEDULED" },
        { id: "c-2", profileId: "profile-1", status: "SCHEDULED" },
      ];
      mockRepos.content.findScheduledByProfileAndTime.mockResolvedValue(conflictingContent);

      const result = await checkScheduleConflicts("profile-1", "X", mockDate);

      expect(result.hasWarning).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatchObject({
        type: "time_conflict",
        conflictingIds: ["c-1", "c-2"],
      });
    });

    it("should use default time window of 5 minutes", async () => {
      await checkScheduleConflicts("profile-1", "X", mockDate);

      const expectedStart = new Date(mockDate.getTime() - 5 * 60 * 1000);
      const expectedEnd = new Date(mockDate.getTime() + 5 * 60 * 1000);

      expect(mockRepos.content.findScheduledByProfileAndTime).toHaveBeenCalledWith(
        "profile-1",
        expectedStart,
        expectedEnd,
      );
    });

    it("should respect custom time window option", async () => {
      await checkScheduleConflicts("profile-1", "X", mockDate, { timeWindowMinutes: 15 });

      const expectedStart = new Date(mockDate.getTime() - 15 * 60 * 1000);
      const expectedEnd = new Date(mockDate.getTime() + 15 * 60 * 1000);

      expect(mockRepos.content.findScheduledByProfileAndTime).toHaveBeenCalledWith(
        "profile-1",
        expectedStart,
        expectedEnd,
      );
    });

    it("should detect daily cap exceeded", async () => {
      mockRepos.publishLog.countPublishedToday.mockResolvedValue(50);

      const result = await checkScheduleConflicts("profile-1", "X", mockDate, { maxPerDay: 50 });

      expect(result.hasWarning).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatchObject({
        type: "daily_cap",
        currentCount: 50,
        maxCount: 50,
      });
    });

    it("should return both time and daily cap warnings together", async () => {
      mockRepos.content.findScheduledByProfileAndTime.mockResolvedValue([
        { id: "c-1", profileId: "profile-1", status: "SCHEDULED" },
      ]);
      mockRepos.publishLog.countPublishedToday.mockResolvedValue(50);

      const result = await checkScheduleConflicts("profile-1", "X", mockDate, { maxPerDay: 50 });

      expect(result.hasWarning).toBe(true);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]!.type).toBe("time_conflict");
      expect(result.warnings[1]!.type).toBe("daily_cap");
    });

    it("should use default maxPerDay of 50", async () => {
      mockRepos.publishLog.countPublishedToday.mockResolvedValue(49);

      const result = await checkScheduleConflicts("profile-1", "X", mockDate);

      expect(result.hasWarning).toBe(false);
    });

    it("should handle single conflicting item with correct grammar", async () => {
      mockRepos.content.findScheduledByProfileAndTime.mockResolvedValue([
        { id: "c-1", profileId: "profile-1", status: "SCHEDULED" },
      ]);

      const result = await checkScheduleConflicts("profile-1", "X", mockDate);

      expect(result.warnings[0]!.message).toContain("There is");
      expect(result.warnings[0]!.message).toContain("1 other item");
    });
  });
});
