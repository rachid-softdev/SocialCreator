/**
 * Tests for Smart Scheduling Optimizer (src/lib/scheduling/optimizer.ts)
 *
 * Covers:
 * - analyzeProfilePerformance() with full, empty, and partial data
 * - getNextOptimalSlot() with and without agents
 * - getDefaultNextSlot() heuristics for every platform
 * - optimalTimeToDate() date arithmetic (past/future, day wrapping)
 * - formatOptimalTime() string formatting (AM/PM, day names)
 * - Error propagation from Prisma
 * - Edge cases: unknown platform, boundary hours, all dayOfWeek values
 */

import type { Platform } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Hoisted mocks
// ============================================

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    analytics: { findMany: vi.fn() },
    agent: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ============================================
// Imports after mocks (hoisted)
// ============================================

import {
  analyzeProfilePerformance,
  formatOptimalTime,
  getNextOptimalSlot,
  optimalTimeToDate,
} from "@/lib/scheduling/optimizer";

describe("Scheduling Optimizer", () => {
  // Freeze time to 2026-06-15 10:30:00 (Monday)
  const FROZEN_NOW = new Date("2026-06-15T10:30:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================
  // analyzeProfilePerformance
  // ============================================

  describe("analyzeProfilePerformance", () => {
    const profileId = "profile-abc-123";

    it("should return empty schedules when no analytics entries exist", async () => {
      mockPrisma.analytics.findMany.mockResolvedValue([]);

      const result = await analyzeProfilePerformance(profileId);

      expect(result.profileId).toBe(profileId);
      expect(result.schedules).toEqual([]);
    });

    it("should group analytics by platform and compute schedule", async () => {
      const analyticsEntries = [
        {
          id: "a1",
          profileId,
          platform: "INSTAGRAM" as Platform,
          date: new Date("2026-06-14"),
          impressions: 120,
          engagements: 30,
          clicks: 5,
        },
        {
          id: "a2",
          profileId,
          platform: "INSTAGRAM" as Platform,
          date: new Date("2026-06-15"),
          impressions: 200,
          engagements: 50,
          clicks: 10,
        },
        {
          id: "a3",
          profileId,
          platform: "TIKTOK" as Platform,
          date: new Date("2026-06-13"),
          impressions: 500,
          engagements: 100,
          clicks: 25,
        },
      ];
      mockPrisma.analytics.findMany.mockResolvedValue(analyticsEntries);

      const result = await analyzeProfilePerformance(profileId);

      expect(mockPrisma.analytics.findMany).toHaveBeenCalledWith({
        where: { profileId, date: { gte: expect.any(Date) } },
        orderBy: { date: "asc" },
      });
      expect(result.profileId).toBe(profileId);
      // 2 distinct platforms
      expect(result.schedules).toHaveLength(2);

      const instagram = result.schedules.find((s) => s.platform === "INSTAGRAM");
      expect(instagram).toBeDefined();
      expect(instagram!.optimalTimes).toHaveLength(3); // defaults
      expect(instagram!.averageEngagement).toBe(0); // < 5 entries → 0

      const tiktok = result.schedules.find((s) => s.platform === "TIKTOK");
      expect(tiktok).toBeDefined();
    });

    it("should compute averageEngagement when data length >= 5", async () => {
      // 5 entries for INSTAGRAM
      const entries = Array.from({ length: 5 }, (_, i) => ({
        id: `a${i}`,
        profileId,
        platform: "INSTAGRAM" as Platform,
        date: new Date(2026, 5, 10 + i),
        impressions: 100 * (i + 1),
        engagements: 10 * (i + 1),
        clicks: 2 * (i + 1),
      }));
      mockPrisma.analytics.findMany.mockResolvedValue(entries);

      const result = await analyzeProfilePerformance(profileId);

      const instagram = result.schedules.find((s) => s.platform === "INSTAGRAM");
      expect(instagram).toBeDefined();
      // Average engagement: (10+20+30+40+50) / 5 = 30
      expect(instagram!.averageEngagement).toBe(30);
      // With >= 5 entries, worstTimes should be populated
      expect(instagram!.worstTimes).toHaveLength(2);
    });

    it("should propagate Prisma errors", async () => {
      mockPrisma.analytics.findMany.mockRejectedValue(new Error("DB connection failed"));

      await expect(analyzeProfilePerformance(profileId)).rejects.toThrow("DB connection failed");
    });

    it("should handle multiple analytics entries on same day", async () => {
      const entries = [
        {
          id: "a1",
          profileId,
          platform: "INSTAGRAM" as Platform,
          date: new Date("2026-06-15"),
          impressions: 100,
          engagements: 25,
          clicks: 3,
        },
        {
          id: "a2",
          profileId,
          platform: "INSTAGRAM" as Platform,
          date: new Date("2026-06-15"),
          impressions: 150,
          engagements: 40,
          clicks: 5,
        },
      ];
      mockPrisma.analytics.findMany.mockResolvedValue(entries);

      const result = await analyzeProfilePerformance(profileId);

      expect(result.schedules).toHaveLength(1);
      expect(result.schedules[0].platform).toBe("INSTAGRAM");
    });

    it("should return default optimalTimes for platforms with < 5 entries", async () => {
      const entries = [
        {
          id: "a1",
          profileId,
          platform: "LINKEDIN" as Platform,
          date: new Date("2026-06-14"),
          impressions: 80,
          engagements: 15,
          clicks: 2,
        },
      ];
      mockPrisma.analytics.findMany.mockResolvedValue(entries);

      const result = await analyzeProfilePerformance(profileId);

      const linkedin = result.schedules.find((s) => s.platform === "LINKEDIN");
      expect(linkedin).toBeDefined();
      expect(linkedin!.optimalTimes).toHaveLength(3);
      // First default for LINKEDIN: Tuesday at 8AM
      expect(linkedin!.optimalTimes[0].hour).toBe(8);
      expect(linkedin!.optimalTimes[0].dayOfWeek).toBe(2);
      expect(linkedin!.optimalTimes[0].score).toBe(90);
    });
  });

  // ============================================
  // getNextOptimalSlot
  // ============================================

  describe("getNextOptimalSlot", () => {
    const profileId = "profile-xyz-789";
    const platform: Platform = "INSTAGRAM";

    it("should return next slot +2 hours when agents exist", async () => {
      mockPrisma.agent.findMany.mockResolvedValue([{ id: "agent-1" }]);

      const result = await getNextOptimalSlot(profileId, platform);

      const expectedHour = FROZEN_NOW.getHours() + 2; // 12
      expect(result.nextSlot.getHours()).toBe(expectedHour);
      expect(result.nextSlot.getMinutes()).toBe(0);
      expect(result.reason).toBe("Based on platform best practices");
    });

    it("should use default heuristics when no agents exist", async () => {
      mockPrisma.agent.findMany.mockResolvedValue([]);

      const result = await getNextOptimalSlot(profileId, platform);

      // FROZEN_NOW hour is 10, targetHour for INSTAGRAM is 9
      // hour (10) >= targetHour (9) → fallback hour (12) tomorrow
      const tomorrow = new Date(FROZEN_NOW);
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(result.nextSlot.getDate()).toBe(tomorrow.getDate());
      expect(result.nextSlot.getHours()).toBe(12);
      expect(result.reason).toContain("Best time for INSTAGRAM");
    });

    it("should propagate Prisma errors", async () => {
      mockPrisma.agent.findMany.mockRejectedValue(new Error("Agent fetch failed"));

      await expect(getNextOptimalSlot(profileId, platform)).rejects.toThrow("Agent fetch failed");
    });

    it("should call prisma with correct query", async () => {
      mockPrisma.agent.findMany.mockResolvedValue([]);

      await getNextOptimalSlot(profileId, platform);

      expect(mockPrisma.agent.findMany).toHaveBeenCalledWith({
        where: { profileId, platforms: { has: platform }, isActive: true },
      });
    });
  });

  // ============================================
  // getDefaultNextSlot heuristics (tested through getNextOptimalSlot with no agents)
  // ============================================

  describe("default slot heuristics", () => {
    const profileId = "profile-default";

    it("should schedule at targetHour when current hour < targetHour", async () => {
      // Freeze at 6AM — before most targetHours (e.g., INSTAGRAM target=9)
      vi.setSystemTime(new Date("2026-06-15T06:00:00.000Z"));
      mockPrisma.agent.findMany.mockResolvedValue([]);

      const result = await getNextOptimalSlot(profileId, "INSTAGRAM");

      expect(result.nextSlot.getHours()).toBe(9);
      expect(result.nextSlot.getDate()).toBe(15); // same day
    });

    it("should schedule at fallbackHour tomorrow when current hour >= targetHour", async () => {
      // Freeze at 14:00 — after INSTAGRAM target=9
      vi.setSystemTime(new Date("2026-06-15T14:00:00.000Z"));
      mockPrisma.agent.findMany.mockResolvedValue([]);

      const result = await getNextOptimalSlot(profileId, "INSTAGRAM");

      expect(result.nextSlot.getDate()).toBe(16); // next day
      expect(result.nextSlot.getHours()).toBe(12); // fallback
    });

    it("should use default fallback values for unknown platform", async () => {
      vi.setSystemTime(new Date("2026-06-15T06:00:00.000Z"));
      mockPrisma.agent.findMany.mockResolvedValue([]);

      const result = await getNextOptimalSlot(profileId, "UNKNOWN" as Platform);

      // unknown platform → targetHour: 12, fallbackHour: 18
      // hour 6 < 12 → targetHour today
      expect(result.nextSlot.getHours()).toBe(12);
      expect(result.reason).toContain("Best time for UNKNOWN");
    });

    it("should use fallback for unknown platform when past targetHour", async () => {
      vi.setSystemTime(new Date("2026-06-15T15:00:00.000Z"));
      mockPrisma.agent.findMany.mockResolvedValue([]);

      const result = await getNextOptimalSlot(profileId, "UNKNOWN" as Platform);

      // unknown → targetHour: 12, fallbackHour: 18
      // hour 15 >= 12 → fallback tomorrow
      expect(result.nextSlot.getDate()).toBe(16);
      expect(result.nextSlot.getHours()).toBe(18);
    });
  });

  // ============================================
  // optimalTimeToDate
  // ============================================

  describe("optimalTimeToDate", () => {
    it("should compute date for same day of week in the future", () => {
      // Frozen: Monday 2026-06-15 10:30
      // dayOfWeek 1 (Monday), hour 14 → later today
      const result = optimalTimeToDate({
        hour: 14,
        dayOfWeek: 1,
        score: 85,
        reason: "test",
      });

      expect(result.getDay()).toBe(1); // Monday
      expect(result.getDate()).toBe(15); // today
      expect(result.getHours()).toBe(14);
    });

    it("should advance to next week when computed time is in the past", () => {
      // Frozen: Monday 2026-06-15 10:30
      // dayOfWeek 1 (Monday), hour 8 → earlier today → past → +7 days
      const result = optimalTimeToDate({
        hour: 8,
        dayOfWeek: 1,
        score: 85,
        reason: "test",
      });

      expect(result.getDate()).toBe(22); // next Monday
      expect(result.getHours()).toBe(8);
    });

    it("should advance dayOfWeek to correct future day", () => {
      // Frozen: Monday 2026-06-15 10:30
      // dayOfWeek 3 (Wednesday) → +2 days → Wednesday 2026-06-17
      const result = optimalTimeToDate({
        hour: 9,
        dayOfWeek: 3,
        score: 90,
        reason: "test",
      });

      expect(result.getDay()).toBe(3); // Wednesday
      expect(result.getDate()).toBe(17);
      expect(result.getHours()).toBe(9);
    });

    it("should wrap around when target day is earlier in week", () => {
      // Frozen: Monday 2026-06-15 10:30
      // dayOfWeek 6 (Saturday) → +5 days → Saturday 2026-06-20
      const result = optimalTimeToDate({
        hour: 10,
        dayOfWeek: 6,
        score: 75,
        reason: "test",
      });

      expect(result.getDay()).toBe(6); // Saturday
      expect(result.getDate()).toBe(20);
    });

    it("should handle all dayOfWeek values 0-6", () => {
      // Frozen: Monday 2026-06-15 (dayOfWeek=1)
      for (let targetDay = 0; targetDay <= 6; targetDay++) {
        const result = optimalTimeToDate({
          hour: 12,
          dayOfWeek: targetDay,
          score: 80,
          reason: `test day ${targetDay}`,
        });

        expect(result.getDay()).toBe(targetDay);
      }
    });

    it("should push to next week when target day is today but hour is past", () => {
      // Frozen: Monday 2026-06-15 10:30
      // dayOfWeek 1 (Monday), hour 10 → same hour, not past (10:30 > 10:00)
      // Actually 10:30 is AFTER 10:00, so it should be in the past → +7 days
      // Wait: result.setHours(10, 0, 0, 0) gives 10:00, and now is 10:30, so result < now
      const result = optimalTimeToDate({
        hour: 10,
        dayOfWeek: 1,
        score: 80,
        reason: "test",
      });

      expect(result.getDate()).toBe(22); // next week
    });
  });

  // ============================================
  // formatOptimalTime
  // ============================================

  describe("formatOptimalTime", () => {
    it("should format morning hour as XAM", () => {
      const result = formatOptimalTime({
        hour: 9,
        dayOfWeek: 1,
        score: 85,
        reason: "Peak",
      });

      expect(result).toBe("Monday at 9AM");
    });

    it("should format noon as 12PM", () => {
      const result = formatOptimalTime({
        hour: 12,
        dayOfWeek: 3,
        score: 80,
        reason: "Lunch",
      });

      expect(result).toBe("Wednesday at 12PM");
    });

    it("should format afternoon hour as XPM", () => {
      const result = formatOptimalTime({
        hour: 14,
        dayOfWeek: 5,
        score: 75,
        reason: "Afternoon",
      });

      expect(result).toBe("Friday at 2PM");
    });

    it("should format midnight as 0AM", () => {
      const result = formatOptimalTime({
        hour: 0,
        dayOfWeek: 0,
        score: 10,
        reason: "Late night",
      });

      expect(result).toBe("Sunday at 0AM");
    });

    it("should format evening hour correctly", () => {
      const result = formatOptimalTime({
        hour: 21,
        dayOfWeek: 6,
        score: 80,
        reason: "Evening",
      });

      expect(result).toBe("Saturday at 9PM");
    });

    it("should handle all dayOfWeek values", () => {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      for (let d = 0; d <= 6; d++) {
        const result = formatOptimalTime({
          hour: 12,
          dayOfWeek: d,
          score: 50,
          reason: "test",
        });

        expect(result).toBe(`${days[d]} at 12PM`);
      }
    });
  });
});
