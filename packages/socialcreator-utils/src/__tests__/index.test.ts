import { describe, expect, it } from "vitest";
import {
  cn,
  formatDate,
  formatDateTime,
  formatDuration,
  hashContent,
  startOfDayUTC,
} from "../index";

describe("@socialcreator/utils", () => {
  describe("cn", () => {
    it("should merge class names", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("should handle conditional classes", () => {
      expect(cn("base", false && "hidden", "active")).toBe("base active");
    });

    it("should handle undefined and null values", () => {
      expect(cn("a", undefined, null, "b")).toBe("a b");
    });

    it("should handle tailwind conflict resolution via twMerge", () => {
      // twMerge should resolve px-4 over px-2
      const result = cn("px-2", "px-4");
      expect(result).toBe("px-4");
    });

    it("should return empty string for no inputs", () => {
      expect(cn()).toBe("");
    });

    it("should handle array of classes", () => {
      expect(cn(["foo", "bar"])).toBe("foo bar");
    });
  });

  describe("formatDate", () => {
    it("should format a Date object", () => {
      const date = new Date(2025, 0, 15); // Jan 15, 2025
      expect(formatDate(date)).toBe("Jan 15, 2025");
    });

    it("should format an ISO date string", () => {
      expect(formatDate("2025-06-01T12:00:00Z")).toBe("Jun 1, 2025");
    });

    it("should pad single-digit days", () => {
      const date = new Date(2025, 2, 5); // Mar 5, 2025
      expect(formatDate(date)).toBe("Mar 5, 2025");
    });

    it("should handle December dates", () => {
      const date = new Date(2025, 11, 25); // Dec 25, 2025
      expect(formatDate(date)).toBe("Dec 25, 2025");
    });
  });

  describe("formatDateTime", () => {
    it("should format date and time from Date object", () => {
      const date = new Date(2025, 0, 15, 14, 30); // Jan 15, 2025, 2:30 PM local
      const result = formatDateTime(date);
      expect(result).toContain("Jan 15, 2025");
      expect(result).toMatch(/\d+:\d+\s*(AM|PM)/);
    });

    it("should format date and time from string", () => {
      // Only assert the date portion (time display depends on runtime timezone)
      const result = formatDateTime("2025-06-01T12:00:00Z");
      expect(result).toContain("Jun 1, 2025");
      // Should contain time separators and AM/PM indicator
      expect(result).toMatch(/2025/);
      expect(result).toMatch(/\d+:\d+\s*(AM|PM)/);
    });

    it("should show midnight", () => {
      const date = new Date(2025, 6, 4, 0, 0); // local timezone midnight
      const result = formatDateTime(date);
      expect(result).toContain("Jul 4, 2025");
      expect(result).toMatch(/\d+:\d+\s*(AM|PM)/);
    });
  });

  describe("startOfDayUTC", () => {
    it("should zero out time components", () => {
      const date = new Date("2025-06-15T14:30:45.123Z");
      const result = startOfDayUTC(date);
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
    });

    it("should preserve the date", () => {
      const date = new Date("2025-06-15T14:30:00Z");
      const result = startOfDayUTC(date);
      expect(result.getUTCFullYear()).toBe(2025);
      expect(result.getUTCMonth()).toBe(5); // June
      expect(result.getUTCDate()).toBe(15);
    });

    it("should not mutate the original date", () => {
      const date = new Date("2025-06-15T14:30:00Z");
      const original = date.getTime();
      startOfDayUTC(date);
      expect(date.getTime()).toBe(original);
    });

    it("should handle dates at UTC midnight", () => {
      const date = new Date("2025-01-01T00:00:00.000Z");
      const result = startOfDayUTC(date);
      expect(result.getTime()).toBe(date.getTime());
    });
  });

  describe("formatDuration", () => {
    it('should return "<1s" for durations under 1000ms', () => {
      expect(formatDuration(500)).toBe("<1s");
      expect(formatDuration(0)).toBe("<1s");
      expect(formatDuration(999)).toBe("<1s");
    });

    it("should return seconds for durations under 60s", () => {
      expect(formatDuration(1000)).toBe("1s");
      expect(formatDuration(5000)).toBe("5s");
      expect(formatDuration(59000)).toBe("59s");
    });

    it("should return minutes for durations 60s and above", () => {
      expect(formatDuration(60000)).toBe("1min");
      expect(formatDuration(120000)).toBe("2min");
      expect(formatDuration(3600000)).toBe("60min");
    });

    it("should round seconds correctly", () => {
      expect(formatDuration(1500)).toBe("2s");
      expect(formatDuration(1400)).toBe("1s");
    });
  });

  describe("hashContent", () => {
    it("should return a 64-character hex string (SHA-256)", () => {
      const hash = hashContent("test content");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should be deterministic for the same input", () => {
      expect(hashContent("hello")).toBe(hashContent("hello"));
    });

    it("should produce different hashes for different inputs", () => {
      expect(hashContent("hello")).not.toBe(hashContent("world"));
    });

    it("should handle empty string", () => {
      const hash = hashContent("");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle unicode characters", () => {
      const hash = hashContent("héllo wörld 🎉");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle very long strings", () => {
      const long = "x".repeat(100000);
      const hash = hashContent(long);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
