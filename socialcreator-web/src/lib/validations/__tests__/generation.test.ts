/**
 * Tests for Content Generation Validation Schemas
 * Covers: generateContentSchema, generateContentBatchSchema
 */

import { describe, expect, it } from "vitest";
import { generateContentBatchSchema, generateContentSchema } from "../generation";

describe("generateContentSchema", () => {
  it("accepts valid minimal input", () => {
    const result = generateContentSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platform: "X",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.count).toBe(1); // default
    }
  });

  it("accepts valid full input with all optional fields", () => {
    const result = generateContentSchema.safeParse({
      profileId: "profile-123",
      brief: "Create a post about AI trends",
      platform: "LINKEDIN",
      count: 3,
      keywords: ["AI", "machine learning", "trends"],
      brandVoice: "Professional and insightful",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty profileId", () => {
    const result = generateContentSchema.safeParse({
      profileId: "",
      brief: "A brief of at least 10 characters",
      platform: "X",
    });
    expect(result.success).toBe(false);
  });

  it("rejects brief shorter than 10 characters", () => {
    const result = generateContentSchema.safeParse({
      profileId: "profile-123",
      brief: "Too short",
      platform: "INSTAGRAM",
    });
    expect(result.success).toBe(false);
  });

  it("rejects brief longer than 2000 characters", () => {
    const result = generateContentSchema.safeParse({
      profileId: "profile-123",
      brief: "A".repeat(2001),
      platform: "YOUTUBE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid platform", () => {
    const result = generateContentSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platform: "SNAPCHAT",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid platforms", () => {
    const platforms = [
      "TIKTOK",
      "INSTAGRAM",
      "YOUTUBE",
      "FACEBOOK",
      "X",
      "LINKEDIN",
      "THREADS",
      "PINTEREST",
    ] as const;
    for (const platform of platforms) {
      const result = generateContentSchema.safeParse({
        profileId: "profile-123",
        brief: "A brief of at least 10 characters",
        platform,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects count less than 1", () => {
    const result = generateContentSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platform: "FACEBOOK",
      count: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects count greater than 5", () => {
    const result = generateContentSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platform: "THREADS",
      count: 6,
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 keywords", () => {
    const result = generateContentSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platform: "PINTEREST",
      keywords: Array.from({ length: 11 }, (_, i) => `keyword-${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 10 keywords", () => {
    const result = generateContentSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platform: "TIKTOK",
      keywords: Array.from({ length: 10 }, (_, i) => `keyword-${i}`),
    });
    expect(result.success).toBe(true);
  });

  it("rejects brandVoice longer than 500 characters", () => {
    const result = generateContentSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platform: "YOUTUBE",
      brandVoice: "X".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts brandVoice of exactly 500 characters", () => {
    const result = generateContentSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platform: "LINKEDIN",
      brandVoice: "X".repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = generateContentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects non-integer count", () => {
    const result = generateContentSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platform: "X",
      count: 2.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-string keywords array items", () => {
    const result = generateContentSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platform: "X",
      keywords: [123, 456],
    });
    expect(result.success).toBe(false);
  });
});

describe("generateContentBatchSchema", () => {
  it("accepts valid batch input with single platform", () => {
    const result = generateContentBatchSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platforms: ["X"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.count).toBe(1); // default
    }
  });

  it("accepts valid batch input with multiple platforms", () => {
    const result = generateContentBatchSchema.safeParse({
      profileId: "profile-123",
      brief: "Generate content for all platforms",
      platforms: ["TIKTOK", "INSTAGRAM", "YOUTUBE", "FACEBOOK"],
      count: 2,
      keywords: ["social", "media"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts all 8 platforms at once", () => {
    const result = generateContentBatchSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platforms: [
        "TIKTOK",
        "INSTAGRAM",
        "YOUTUBE",
        "FACEBOOK",
        "X",
        "LINKEDIN",
        "THREADS",
        "PINTEREST",
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty platforms array", () => {
    const result = generateContentBatchSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platforms: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 8 platforms", () => {
    const result = generateContentBatchSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platforms: [
        "TIKTOK",
        "INSTAGRAM",
        "YOUTUBE",
        "FACEBOOK",
        "X",
        "LINKEDIN",
        "THREADS",
        "PINTEREST",
        "TIKTOK",
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty profileId", () => {
    const result = generateContentBatchSchema.safeParse({
      profileId: "",
      brief: "A brief of at least 10 characters",
      platforms: ["X"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid platform in batch", () => {
    const result = generateContentBatchSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platforms: ["X", "INVALID_PLATFORM"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects brief shorter than 10 characters in batch", () => {
    const result = generateContentBatchSchema.safeParse({
      profileId: "profile-123",
      brief: "Short",
      platforms: ["LINKEDIN"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts duplicate platforms", () => {
    const result = generateContentBatchSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platforms: ["X", "X", "X"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects count less than 1 in batch", () => {
    const result = generateContentBatchSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platforms: ["INSTAGRAM"],
      count: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 keywords in batch", () => {
    const result = generateContentBatchSchema.safeParse({
      profileId: "profile-123",
      brief: "A brief of at least 10 characters",
      platforms: ["YOUTUBE"],
      keywords: Array.from({ length: 11 }, (_, i) => `kw-${i}`),
    });
    expect(result.success).toBe(false);
  });
});
