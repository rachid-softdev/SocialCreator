/**
 * Tests for content validators
 * Based on design spec: docs/architecture/05-publisher-strategy.md
 *
 * Self-contained: implements validators inline matching the design spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ========== Inline types and implementation matching the design spec ==========

interface PublishContent {
  textContent: string;
  mediaUrls: string[];
  hashtags: string[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

type ContentValidator = (content: PublishContent) => Promise<ValidationResult>;

function characterLimitValidator(maxChars: number): ContentValidator {
  return async (content: PublishContent) => {
    const errors: string[] = [];
    if (content.textContent.length > maxChars) errors.push(`Text exceeds ${maxChars} char limit`);
    return { valid: errors.length === 0, errors, warnings: [] };
  };
}

const xValidator: ContentValidator = characterLimitValidator(4000);

const tiktokValidator: ContentValidator = async (content: PublishContent) => {
  const errors: string[] = [];
  if (!content.mediaUrls.some((u) => u.replace(/\?.*$/, "").match(/\.(mp4|mov|avi)$/i)))
    errors.push("TikTok requires at least one video file");
  return { valid: errors.length === 0, errors, warnings: [] };
};

// ========== Tests ==========

describe("Content Validators", () => {
  describe("characterLimitValidator", () => {
    it("should return valid when text is within limit", async () => {
      const validator = characterLimitValidator(100);
      const content: PublishContent = { textContent: "Short text", mediaUrls: [], hashtags: [] };

      const result = await validator(content);

      expect(result.valid).toBe(true);
      expect(result.errors).toStrictEqual([]);
    });

    it("should return invalid when text exceeds limit", async () => {
      const validator = characterLimitValidator(10);
      const content: PublishContent = {
        textContent: "This is a very long text that exceeds the limit",
        mediaUrls: [],
        hashtags: [],
      };

      const result = await validator(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Text exceeds 10 char limit");
    });

    it("should handle exact boundary (text equals limit)", async () => {
      const validator = characterLimitValidator(5);
      const content: PublishContent = { textContent: "12345", mediaUrls: [], hashtags: [] };

      const result = await validator(content);

      expect(result.valid).toBe(true);
    });

    it("should handle empty string (under limit)", async () => {
      const validator = characterLimitValidator(100);
      const content: PublishContent = { textContent: "", mediaUrls: [], hashtags: [] };

      const result = await validator(content);

      expect(result.valid).toBe(true);
    });

    it("should return warnings as empty array always", async () => {
      const validator = characterLimitValidator(100);
      const content: PublishContent = { textContent: "Hello", mediaUrls: [], hashtags: [] };

      const result = await validator(content);

      expect(result.warnings).toStrictEqual([]);
    });
  });

  describe("xValidator", () => {
    it("should validate text within 4000 characters", async () => {
      const content: PublishContent = {
        textContent: "A".repeat(4000),
        mediaUrls: [],
        hashtags: [],
      };

      const result = await xValidator(content);

      expect(result.valid).toBe(true);
    });

    it("should fail for text exceeding 4000 characters", async () => {
      const content: PublishContent = {
        textContent: "A".repeat(4001),
        mediaUrls: [],
        hashtags: [],
      };

      const result = await xValidator(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Text exceeds 4000 char limit");
    });

    it("should pass for short text", async () => {
      const content: PublishContent = { textContent: "Hello world", mediaUrls: [], hashtags: [] };

      const result = await xValidator(content);

      expect(result.valid).toBe(true);
    });
  });

  describe("tiktokValidator", () => {
    it("should pass when content contains at least one video file", async () => {
      const content: PublishContent = {
        textContent: "TikTok video",
        mediaUrls: ["https://example.com/video.mp4"],
        hashtags: [],
      };

      const result = await tiktokValidator(content);

      expect(result.valid).toBe(true);
    });

    it("should support .mov and .avi video formats", async () => {
      const contentMov: PublishContent = {
        textContent: "mov video",
        mediaUrls: ["https://example.com/clip.mov"],
        hashtags: [],
      };
      const contentAvi: PublishContent = {
        textContent: "avi video",
        mediaUrls: ["https://example.com/clip.avi"],
        hashtags: [],
      };

      const movResult = await tiktokValidator(contentMov);
      const aviResult = await tiktokValidator(contentAvi);

      expect(movResult.valid).toBe(true);
      expect(aviResult.valid).toBe(true);
    });

    it("should fail when no video file is present", async () => {
      const content: PublishContent = {
        textContent: "No video",
        mediaUrls: ["https://example.com/image.jpg"],
        hashtags: [],
      };

      const result = await tiktokValidator(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("TikTok requires at least one video file");
    });

    it("should fail when mediaUrls is empty", async () => {
      const content: PublishContent = { textContent: "No media", mediaUrls: [], hashtags: [] };

      const result = await tiktokValidator(content);

      expect(result.valid).toBe(false);
    });

    it("should pass when multiple videos and images are present", async () => {
      const content: PublishContent = {
        textContent: "Mixed media",
        mediaUrls: [
          "https://example.com/image.jpg",
          "https://example.com/video.mp4",
          "https://example.com/thumb.png",
        ],
        hashtags: [],
      };

      const result = await tiktokValidator(content);

      expect(result.valid).toBe(true);
    });

    it("should handle URLs with uppercase extensions", async () => {
      const content: PublishContent = {
        textContent: "Uppercase",
        mediaUrls: ["https://example.com/video.MP4"],
        hashtags: [],
      };

      const result = await tiktokValidator(content);

      expect(result.valid).toBe(true);
    });

    it("should handle URLs with query parameters", async () => {
      const content: PublishContent = {
        textContent: "URL with params",
        mediaUrls: ["https://example.com/video.mp4?token=abc&expires=123"],
        hashtags: [],
      };

      const result = await tiktokValidator(content);

      expect(result.valid).toBe(true);
    });
  });
});
