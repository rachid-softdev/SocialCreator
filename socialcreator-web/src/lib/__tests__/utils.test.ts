import { describe, expect, it } from "vitest";
import { formatDate, hashContent, startOfDayUTC } from "../utils";

describe("utils", () => {
  describe("startOfDayUTC", () => {
    it("should return start of day in UTC", () => {
      const result = startOfDayUTC(new Date("2024-06-15T14:30:00Z"));

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
    });

    it("should handle different dates", () => {
      const date1 = startOfDayUTC(new Date("2024-01-01T23:59:59Z"));
      const date2 = startOfDayUTC(new Date("2024-12-31T00:00:01Z"));

      expect(date1.getTime()).toBeLessThan(date2.getTime());
    });
  });

  describe("hashContent", () => {
    it("should produce consistent hash for same input", () => {
      const content = "Hello World";
      const hash1 = hashContent(content);
      const hash2 = hashContent(content);

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different content", () => {
      const hash1 = hashContent("Hello");
      const hash2 = hashContent("World");

      expect(hash1).not.toBe(hash2);
    });

    it("should return a 64-character hex string", () => {
      const hash = hashContent("test");

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle empty string", () => {
      const hash = hashContent("");

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("formatDate", () => {
    it("should format date correctly", () => {
      const date = new Date("2024-06-15");
      const formatted = formatDate(date);

      expect(formatted).toContain("2024");
      expect(formatted).toContain("15");
    });
  });
});
