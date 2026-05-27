/**
 * @jest-environment node
 */

import { startOfDayUTC, hashContent, formatDate, truncateText, slugify } from "../utils";

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

  describe("truncateText", () => {
    it("should not truncate text shorter than maxLength", () => {
      const text = "Short text";
      const result = truncateText(text, 20);

      expect(result).toBe(text);
    });

    it("should truncate text longer than maxLength", () => {
      const text = "This is a very long text that should be truncated";
      const result = truncateText(text, 20);

      expect(result.length).toBeLessThanOrEqual(23); // 20 + "..."
      expect(result.endsWith("...")).toBe(true);
    });

    it("should handle exact maxLength", () => {
      const text = "Exactly twenty char";
      const result = truncateText(text, 20);

      expect(result).toBe(text);
    });

    it("should handle empty string", () => {
      const result = truncateText("", 10);

      expect(result).toBe("");
    });
  });

  describe("slugify", () => {
    it("should convert text to slug", () => {
      expect(slugify("Hello World")).toBe("hello-world");
      expect(slugify("Some Title Here")).toBe("some-title-here");
    });

    it("should remove special characters", () => {
      expect(slugify("Test@#$%Value")).toBe("testvalue");
      expect(slugify("Hello  World")).toBe("hello-world");
    });

    it("should handle underscores and hyphens", () => {
      expect(slugify("test_value")).toBe("test-value");
      expect(slugify("test-value")).toBe("test-value");
    });

    it("should handle empty string", () => {
      expect(slugify("")).toBe("");
    });

    it("should handle unicode", () => {
      expect(slugify("日本語")).toBe("");
      expect(slugify("Hello")).toBe("hello");
    });
  });
});
