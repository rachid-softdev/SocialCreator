/**
 * Tests for conflict-detector (schedule conflict detection)
 *
 * Verifies:
 * - Time conflict detection (overlapping scheduled items)
 * - Daily cap enforcement
 * - No warnings when no conflicts exist
 * - Edge cases: 0 items, boundary times, etc.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkScheduleConflicts } from "../conflict-detector";

// ── Mocks ────────────────────────────────────────────────────────────────

const mockGetRepositories = vi.hoisted(() => vi.fn());

vi.mock("@/lib/repositories", () => ({
  getRepositories: mockGetRepositories,
}));

// ── Tests ────────────────────────────────────────────────────────────────

describe("checkScheduleConflicts", () => {
  const mockContentRepo = {
    findScheduledByProfileAndTime: vi.fn(),
    findById: vi.fn(),
    findByProfileId: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
  };

  const mockPublishLogRepo = {
    countPublishedToday: vi.fn(),
    findSuccessfulByContentHash: vi.fn(),
    create: vi.fn(),
  };

  const baseDate = new Date("2025-06-15T14:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    (mockGetRepositories as any).mockReturnValue({
      content: mockContentRepo,
      publishLog: mockPublishLogRepo,
    });
    mockContentRepo.findScheduledByProfileAndTime.mockResolvedValue([]);
    mockPublishLogRepo.countPublishedToday.mockResolvedValue(0);
  });

  it("returns no warnings when no conflicts exist", async () => {
    const result = await checkScheduleConflicts("profile-1", "X" as any, baseDate);

    expect(result.hasWarning).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it("detects time conflicts with overlapping scheduled items", async () => {
    const conflicting = [
      { id: "content-2", scheduledPublishAt: new Date("2025-06-15T14:02:00Z") },
      { id: "content-3", scheduledPublishAt: new Date("2025-06-15T14:03:00Z") },
    ];
    mockContentRepo.findScheduledByProfileAndTime.mockResolvedValue(conflicting);

    const result = await checkScheduleConflicts("profile-1", "X" as any, baseDate);

    expect(result.hasWarning).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.type).toBe("time_conflict");
    expect(result.warnings[0]!.conflictingIds).toEqual(["content-2", "content-3"]);
    expect(result.warnings[0]!.message).toContain("2 other items");
  });

  it("uses correct singular wording for a single conflict", async () => {
    mockContentRepo.findScheduledByProfileAndTime.mockResolvedValue([
      { id: "content-2", scheduledPublishAt: new Date("2025-06-15T14:02:00Z") },
    ]);

    const result = await checkScheduleConflicts("profile-1", "X" as any, baseDate);

    expect(result.warnings[0]!.message).toContain("1 other item");
  });

  it("uses custom time window when provided", async () => {
    await checkScheduleConflicts("profile-1", "X" as any, baseDate, {
      timeWindowMinutes: 30,
    });

    const start = new Date(baseDate.getTime() - 30 * 60 * 1000);
    const end = new Date(baseDate.getTime() + 30 * 60 * 1000);
    expect(mockContentRepo.findScheduledByProfileAndTime).toHaveBeenCalledWith(
      "profile-1",
      start,
      end,
    );
  });

  it("detects daily cap exceeded", async () => {
    mockPublishLogRepo.countPublishedToday.mockResolvedValue(50);

    const result = await checkScheduleConflicts("profile-1", "X" as any, baseDate);

    expect(result.hasWarning).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.type).toBe("daily_cap");
    expect(result.warnings[0]!.currentCount).toBe(50);
    expect(result.warnings[0]!.maxCount).toBe(50);
  });

  it("uses custom maxPerDay when provided", async () => {
    mockPublishLogRepo.countPublishedToday.mockResolvedValue(10);

    const result = await checkScheduleConflicts("profile-1", "X" as any, baseDate, {
      maxPerDay: 10,
    });

    expect(result.hasWarning).toBe(true);
    expect(result.warnings[0]!.type).toBe("daily_cap");
  });

  it("does not trigger daily cap warning when under limit", async () => {
    mockPublishLogRepo.countPublishedToday.mockResolvedValue(49);

    const result = await checkScheduleConflicts("profile-1", "X" as any, baseDate, {
      maxPerDay: 50,
    });

    const dailyCapWarning = result.warnings.find((w) => w.type === "daily_cap");
    expect(dailyCapWarning).toBeUndefined();
  });

  it("returns both time and daily cap warnings when both triggered", async () => {
    mockContentRepo.findScheduledByProfileAndTime.mockResolvedValue([
      { id: "content-2", scheduledPublishAt: new Date("2025-06-15T14:02:00Z") },
    ]);
    mockPublishLogRepo.countPublishedToday.mockResolvedValue(50);

    const result = await checkScheduleConflicts("profile-1", "X" as any, baseDate);

    expect(result.hasWarning).toBe(true);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings.map((w) => w.type).sort()).toEqual(["daily_cap", "time_conflict"]);
  });

  it("queries with the correct profile and platform", async () => {
    await checkScheduleConflicts("profile-abc", "INSTAGRAM" as any, baseDate);

    expect(mockContentRepo.findScheduledByProfileAndTime).toHaveBeenCalledWith(
      "profile-abc",
      expect.any(Date),
      expect.any(Date),
    );
    expect(mockPublishLogRepo.countPublishedToday).toHaveBeenCalledWith("profile-abc", "INSTAGRAM");
  });

  it("handles empty conflicting items array", async () => {
    mockContentRepo.findScheduledByProfileAndTime.mockResolvedValue([]);

    const result = await checkScheduleConflicts("profile-1", "X" as any, baseDate);

    const timeWarning = result.warnings.find((w) => w.type === "time_conflict");
    expect(timeWarning).toBeUndefined();
    expect(result.hasWarning).toBe(false);
  });

  it("passes the platform type correctly to countPublishedToday", async () => {
    const platforms: Array<
      "TWITTER" | "INSTAGRAM" | "LINKEDIN" | "TIKTOK" | "FACEBOOK" | "YOUTUBE" | "PINTEREST"
    > = ["TWITTER", "INSTAGRAM", "LINKEDIN", "TIKTOK", "FACEBOOK", "YOUTUBE", "PINTEREST"];

    for (const platform of platforms) {
      await checkScheduleConflicts("profile-1", platform as any, baseDate);
      expect(mockPublishLogRepo.countPublishedToday).toHaveBeenCalledWith("profile-1", platform);
    }
  });
});
