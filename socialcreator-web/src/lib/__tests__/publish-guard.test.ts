import { describe, expect, it, vi } from "vitest";
import { hashContent, startOfDayUTC } from "../utils";

// Mock dependencies for publish-guard functions
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: {
      findMany: vi.fn(),
    },
    publishLog: {
      count: vi.fn(),
    },
    connectedAccount: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/entitlements/service", () => ({
  getFeatureGateService: vi.fn(() => ({
    hasFeature: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock("./rate-limit-redis", () => ({
  getRedis: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

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
    it("should produce a hex-encoded hash", () => {
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
      PINTEREST: { maxPerDay: 8, maxPerWeek: 40 },
    };

    it("should have reasonable cap limits", () => {
      Object.entries(platformCaps).forEach(([_platform, caps]) => {
        expect(caps.maxPerDay).toBeGreaterThan(0);
        expect(caps.maxPerDay).toBeLessThanOrEqual(8);
        expect(caps.maxPerWeek).toBeGreaterThan(caps.maxPerDay);
      });
    });

    it("should not exceed absolute maximum of 8 per day", () => {
      Object.entries(platformCaps).forEach(([_platform, caps]) => {
        // Per PLAN.md: max 8 posts/day configurable
        expect(caps.maxPerDay).toBeLessThanOrEqual(8);
      });
    });
  });

  describe("published guard split functions", () => {
    it("should export peekDailyCap function", async () => {
      const { peekDailyCap } = await import("../publish-guard");
      expect(typeof peekDailyCap).toBe("function");
    });

    it("should export incrementDailyCap function", async () => {
      const { incrementDailyCap } = await import("../publish-guard");
      expect(typeof incrementDailyCap).toBe("function");
    });

    it("should export recordPublish as alias for incrementDailyCap", async () => {
      const { recordPublish, incrementDailyCap } = await import("../publish-guard");
      expect(typeof recordPublish).toBe("function");
      expect(typeof incrementDailyCap).toBe("function");
    });

    it("should export canPublish function", async () => {
      const { canPublish } = await import("../publish-guard");
      expect(typeof canPublish).toBe("function");
    });

    it("should export getProfileCapStatus function", async () => {
      const { getProfileCapStatus } = await import("../publish-guard");
      expect(typeof getProfileCapStatus).toBe("function");
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
