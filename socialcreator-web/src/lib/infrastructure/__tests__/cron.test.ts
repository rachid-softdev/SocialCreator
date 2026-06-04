/**
 * Tests for cron.ts — Cron scheduling utility (Infrastructure)
 *
 * Focuses on:
 * - isValidCron: validates cron expressions
 * - getNextExecution: retrieves next run time
 * - formatNextRun: human-readable relative time
 * - describeCron: human-readable cron description
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNextDate = vi.hoisted(() => new Date("2026-06-04T12:00:00Z"));
const mockInterval = vi.hoisted(() => ({
  next: vi.fn(() => ({ toDate: vi.fn(() => mockNextDate) })),
}));
const mockParseExpression = vi.hoisted(() => vi.fn());

vi.mock("cron-parser", () => ({
  default: {
    parseExpression: mockParseExpression,
  },
}));

// Import after mocks — module-level cron-parser usage happens on call, not import
import { describeCron, formatNextRun, getNextExecution, isValidCron } from "../cron";

describe("cron utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // isValidCron
  // ============================================

  describe("isValidCron", () => {
    it("returns true for a valid cron expression", () => {
      mockParseExpression.mockReturnValue(mockInterval);
      expect(isValidCron("0 9 * * 1-5")).toBe(true);
      expect(mockParseExpression).toHaveBeenCalledWith("0 9 * * 1-5");
    });

    it("returns false for an invalid cron expression", () => {
      mockParseExpression.mockImplementation(() => {
        throw new Error("Invalid cron");
      });
      expect(isValidCron("invalid")).toBe(false);
    });

    it("returns false when parseExpression throws a non-Error", () => {
      mockParseExpression.mockImplementation(() => {
        throw "string error";
      });
      expect(isValidCron("* * * * *")).toBe(false);
    });
  });

  // ============================================
  // getNextExecution
  // ============================================

  describe("getNextExecution", () => {
    it("returns a Date for a valid cron expression", () => {
      mockParseExpression.mockReturnValue(mockInterval);
      const result = getNextExecution("0 12 * * *");
      expect(result).toBeInstanceOf(Date);
      expect(result).toEqual(mockNextDate);
      expect(mockInterval.next).toHaveBeenCalledOnce();
    });

    it("returns null for an invalid cron expression", () => {
      mockParseExpression.mockImplementation(() => {
        throw new Error("Invalid cron");
      });
      expect(getNextExecution("bad")).toBeNull();
    });
  });

  // ============================================
  // formatNextRun
  // ============================================

  describe("formatNextRun", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-04T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns "Past" for dates in the past', () => {
      const past = new Date("2026-06-04T11:00:00Z");
      expect(formatNextRun(past)).toBe("Past");
    });

    it('returns "soon" for dates within the next minute', () => {
      const soon = new Date("2026-06-04T12:00:30Z");
      expect(formatNextRun(soon)).toBe("soon");
    });

    it("returns minutes when less than an hour away", () => {
      const inMinutes = new Date("2026-06-04T12:05:00Z");
      expect(formatNextRun(inMinutes)).toBe("in 5 minutes");
    });

    it("returns singular minute for exactly 1 minute away", () => {
      const inOneMin = new Date("2026-06-04T12:01:00Z");
      expect(formatNextRun(inOneMin)).toBe("in 1 minute");
    });

    it("returns hours when less than a day away", () => {
      const inHours = new Date("2026-06-04T15:00:00Z");
      expect(formatNextRun(inHours)).toBe("in 3 hours");
    });

    it("returns singular hour for exactly 1 hour away", () => {
      const inOneHour = new Date("2026-06-04T13:00:00Z");
      expect(formatNextRun(inOneHour)).toBe("in 1 hour");
    });

    it("returns days when more than 24 hours away", () => {
      const inDays = new Date("2026-06-07T12:00:00Z");
      expect(formatNextRun(inDays)).toBe("in 3 days");
    });

    it("returns singular day for exactly 1 day away", () => {
      const inOneDay = new Date("2026-06-05T12:00:00Z");
      expect(formatNextRun(inOneDay)).toBe("in 1 day");
    });
  });

  // ============================================
  // describeCron
  // ============================================

  describe("describeCron", () => {
    it('returns "Invalid cron expression" for fewer than 5 parts', () => {
      expect(describeCron("* * *")).toBe("Invalid cron expression");
    });

    it('returns "Every hour" for 0 * * * *', () => {
      expect(describeCron("0 * * * *")).toBe("Every hour");
    });

    it('returns "Every minute" for * * * * *', () => {
      expect(describeCron("* * * * *")).toBe("Every minute");
    });

    it("describes a specific hour (0 9 * * *)", () => {
      expect(describeCron("0 9 * * *")).toBe("At 9:00");
    });

    it("describes a specific hour and minute (30 14 * * *)", () => {
      expect(describeCron("30 14 * * *")).toBe("At 14:30");
    });

    it("describes a day of week (0 9 * * 1)", () => {
      expect(describeCron("0 9 * * 1")).toBe("At 9:00 on Monday");
    });

    it("describes a day of month (0 9 15 * *)", () => {
      expect(describeCron("0 9 15 * *")).toBe("At 9:00 on day 15");
    });

    it("describes minutes without specific hour (*/5 * * * *)", () => {
      expect(describeCron("*/5 * * * *")).toBe("*/5 minutes");
    });

    it("extracts the first weekday from a range (0 9 * * 1-5)", () => {
      // parseInt("1") from "1-5" yields 1 (Monday)
      const result = describeCron("0 9 * * 1-5");
      expect(result).toBe("At 9:00 on Monday");
    });
  });
});
