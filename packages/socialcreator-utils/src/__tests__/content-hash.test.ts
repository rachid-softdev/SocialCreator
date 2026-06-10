import { describe, expect, it } from "vitest";
import { computeContentHash } from "../index";

describe("computeContentHash", () => {
  const baseParams = {
    profileId: "profile-1",
    platform: "X",
    textContent: "Hello world",
    mediaUrls: ["https://example.com/img.jpg"],
    hashtags: ["test", "social"],
  };

  it("should produce consistent hash for same inputs (deterministic)", () => {
    const hash1 = computeContentHash(baseParams);
    const hash2 = computeContentHash(baseParams);

    expect(hash1).toBe(hash2);
  });

  it("should produce different hash for different textContent", () => {
    const hash1 = computeContentHash({ ...baseParams, textContent: "Hello" });
    const hash2 = computeContentHash({ ...baseParams, textContent: "World" });

    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hash for different profileId", () => {
    const hash1 = computeContentHash({ ...baseParams, profileId: "profile-a" });
    const hash2 = computeContentHash({ ...baseParams, profileId: "profile-b" });

    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hash for different platform", () => {
    const hash1 = computeContentHash({ ...baseParams, platform: "X" });
    const hash2 = computeContentHash({ ...baseParams, platform: "INSTAGRAM" });

    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hash for different mediaUrls", () => {
    const hash1 = computeContentHash({ ...baseParams, mediaUrls: ["https://example.com/a.jpg"] });
    const hash2 = computeContentHash({ ...baseParams, mediaUrls: ["https://example.com/b.jpg"] });

    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hash for different hashtags", () => {
    const hash1 = computeContentHash({ ...baseParams, hashtags: ["tag1"] });
    const hash2 = computeContentHash({ ...baseParams, hashtags: ["tag2"] });

    expect(hash1).not.toBe(hash2);
  });

  it("should produce same hash regardless of mediaUrls order (sorted)", () => {
    const hash1 = computeContentHash({
      ...baseParams,
      mediaUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
    });
    const hash2 = computeContentHash({
      ...baseParams,
      mediaUrls: ["https://example.com/b.jpg", "https://example.com/a.jpg"],
    });

    expect(hash1).toBe(hash2);
  });

  it("should produce same hash regardless of hashtags order (sorted)", () => {
    const hash1 = computeContentHash({
      ...baseParams,
      hashtags: ["zebra", "apple", "monkey"],
    });
    const hash2 = computeContentHash({
      ...baseParams,
      hashtags: ["apple", "monkey", "zebra"],
    });

    expect(hash1).toBe(hash2);
  });

  it("should handle empty mediaUrls", () => {
    const result = computeContentHash({ ...baseParams, mediaUrls: [] });

    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should handle empty hashtags", () => {
    const result = computeContentHash({ ...baseParams, hashtags: [] });

    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should handle empty textContent", () => {
    const result = computeContentHash({ ...baseParams, textContent: "" });

    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should handle special characters in textContent", () => {
    const result = computeContentHash({
      ...baseParams,
      textContent: "Hello! @#$% ^&*() <test> 🎉",
    });

    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should return a 64-character hex string", () => {
    const hash = computeContentHash(baseParams);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should handle many mediaUrls", () => {
    const manyUrls = Array.from({ length: 100 }, (_, i) => `https://example.com/img-${i}.jpg`);
    const result = computeContentHash({ ...baseParams, mediaUrls: manyUrls });

    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });
});
