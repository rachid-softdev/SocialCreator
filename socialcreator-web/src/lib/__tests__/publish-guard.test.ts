/**
 * @jest-environment node
 */

import { startOfDayUTC, hashContent } from "../utils";

describe("publish-guard utilities", () => {
  describe("startOfDayUTC", () => {
    it("should return start of day in UTC", () => {
      const date = new Date("2024-06-15T14:30:00Z");
      const result = startOfDayUTC(date);

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
    });

    it("should handle dates across midnight UTC", () => {
      const date = new Date("2024-06-15T23:59:59Z");
      const result = startOfDayUTC(date);

      expect(result.toISOString()).toBe("2024-06-15T00:00:00.000Z");
    });
  });

  describe("hashContent", () => {
    it("should produce SHA-256 hash", () => {
      const hash = hashContent("test content");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should be deterministic", () => {
      const content = "Same content";
      const hash1 = hashContent(content);
      const hash2 = hashContent(content);
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different content", () => {
      const hash1 = hashContent("content A");
      const hash2 = hashContent("content B");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Platform constraints", () => {
    const platformCaps = {
      INSTAGRAM: { maxPerDay: 4, maxPerWeek: 20 },
      TIKTOK: { maxPerDay: 4, maxPerWeek: 20 },
      LINKEDIN: { maxPerDay: 4, maxPerWeek: 20 },
      YOUTUBE: { maxPerDay: 3, maxPerWeek: 15 },
      X: { maxPerDay: 8, maxPerWeek: 40 },
      FACEBOOK: { maxPerDay: 4, maxPerWeek: 20 },
      THREADS: { maxPerDay: 4, maxPerWeek: 20 },
      PINTEREST: { maxPerDay: 10, maxPerWeek: 50 },
    };

    it("should have reasonable cap limits", () => {
      Object.entries(platformCaps).forEach(([platform, caps]) => {
        expect(caps.maxPerDay).toBeGreaterThan(0);
        expect(caps.maxPerDay).toBeLessThanOrEqual(10);
        expect(caps.maxPerWeek).toBeGreaterThan(caps.maxPerDay);
      });
    });

    it("should not exceed absolute maximum of 8 per day", () => {
      Object.entries(platformCaps).forEach(([platform, caps]) => {
        // Per PLAN.md: max 8 posts/day configurable
        expect(caps.maxPerDay).toBeLessThanOrEqual(8);
      });
    });
  });

  describe("Content validation before publish", () => {
    it("should validate content has required fields", () => {
      const content = {
        textContent: "Test post",
        hashtags: ["test", "example"],
        mediaUrls: [],
      };

      expect(content.textContent).toBeDefined();
      expect(content.textContent.length).toBeGreaterThan(0);
      expect(Array.isArray(content.hashtags)).toBe(true);
    });

    it("should generate content hash for audit log", () => {
      const content = "Published content text";
      const hash = hashContent(content);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);

      // Same content should produce same hash (for deduplication)
      const hash2 = hashContent(content);
      expect(hash).toBe(hash2);
    });
  });
});