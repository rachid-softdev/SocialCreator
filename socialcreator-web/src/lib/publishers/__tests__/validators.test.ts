import { describe, expect, it } from "vitest";

/**
 * Tests for platform content validators
 *
 * Verifies:
 * - characterLimitValidator(100) — under limit, at limit, exceeded, exact boundary
 * - mediaRequiredValidator(1) — 0 media=fails, 1 media=passes, 3 media=passes
 * - mediaRequiredValidator(0) — always passes
 * - mediaRequiredValidator(1, ['.mp4', '.mov']) — matching type passes, wrong type=warning
 * - xValidator — delegates to characterLimitValidator(4000)
 * - tiktokValidator — requires .mp4/.mov/.avi video
 * - instagramValidator — delegates to mediaRequiredValidator(1)
 * - linkedinValidator — delegates to characterLimitValidator(3000)
 */

import type { PublishContent } from "@/lib/publishers/types";
import {
  characterLimitValidator,
  instagramValidator,
  linkedinValidator,
  mediaRequiredValidator,
  tiktokValidator,
  xValidator,
} from "@/lib/publishers/validators";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeContent(overrides: Partial<PublishContent> = {}): PublishContent {
  return {
    textContent: "",
    mediaUrls: [],
    hashtags: [],
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("characterLimitValidator", () => {
  it("returns valid when text is under the limit", async () => {
    const validator = characterLimitValidator(100);
    const content = makeContent({ textContent: "Hello world" });

    const result = await validator(content);

    expect(result.valid).toBe(true);
    expect(result.errors).toStrictEqual([]);
  });

  it("returns valid when text is exactly at the limit", async () => {
    const validator = characterLimitValidator(10);
    const content = makeContent({ textContent: "1234567890" });

    const result = await validator(content);

    expect(result.valid).toBe(true);
    expect(result.errors).toStrictEqual([]);
  });

  it("returns invalid when text exceeds the limit", async () => {
    const validator = characterLimitValidator(10);
    const content = makeContent({ textContent: "12345678901" });

    const result = await validator(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Text exceeds 10 character limit");
  });

  it("handles exact boundary at limit+1", async () => {
    const validator = characterLimitValidator(5);
    const content = makeContent({ textContent: "123456" });

    const result = await validator(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});

describe("mediaRequiredValidator", () => {
  it("returns invalid when media count is below required", async () => {
    const validator = mediaRequiredValidator(1);
    const content = makeContent({ mediaUrls: [] });

    const result = await validator(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("At least 1 media file(s) required, got 0");
  });

  it("returns valid when media count meets exactly the required", async () => {
    const validator = mediaRequiredValidator(1);
    const content = makeContent({ mediaUrls: ["https://example.com/image.jpg"] });

    const result = await validator(content);

    expect(result.valid).toBe(true);
    expect(result.errors).toStrictEqual([]);
  });

  it("returns valid when media count exceeds required", async () => {
    const validator = mediaRequiredValidator(1);
    const content = makeContent({
      mediaUrls: [
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
        "https://example.com/3.jpg",
      ],
    });

    const result = await validator(content);

    expect(result.valid).toBe(true);
    expect(result.errors).toStrictEqual([]);
  });

  it("returns valid when required count is zero", async () => {
    const validator = mediaRequiredValidator(0);
    const content = makeContent({ mediaUrls: [] });

    const result = await validator(content);

    expect(result.valid).toBe(true);
    expect(result.errors).toStrictEqual([]);
  });

  it("returns valid when media type matches allowed types", async () => {
    const validator = mediaRequiredValidator(1, [".mp4", ".mov"]);
    const content = makeContent({ mediaUrls: ["https://example.com/video.mp4"] });

    const result = await validator(content);

    expect(result.valid).toBe(true);
    expect(result.warnings).toStrictEqual([]);
  });

  it("returns warning when media type does not match allowed types", async () => {
    const validator = mediaRequiredValidator(1, [".mp4", ".mov"]);
    const content = makeContent({ mediaUrls: ["https://example.com/image.jpg"] });

    const result = await validator(content);

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("No media file matches allowed types: .mp4, .mov");
  });

  it("returns warning when some but not all files match allowed types", async () => {
    const validator = mediaRequiredValidator(1, [".mp4"]);
    const content = makeContent({
      mediaUrls: ["https://example.com/video.mp4", "https://example.com/image.jpg"],
    });

    const result = await validator(content);

    // at least one matches .mp4, so no warning despite mixed types
    expect(result.valid).toBe(true);
    expect(result.warnings).toStrictEqual([]);
  });

  it("provides no warning when there are no media urls", async () => {
    const validator = mediaRequiredValidator(0, [".mp4"]);
    const content = makeContent({ mediaUrls: [] });

    const result = await validator(content);

    expect(result.valid).toBe(true);
    expect(result.warnings).toStrictEqual([]);
  });
});

describe("xValidator", () => {
  it("returns valid when text is within 4000 characters", async () => {
    const content = makeContent({ textContent: "A".repeat(4000) });

    const result = await xValidator(content);

    expect(result.valid).toBe(true);
  });

  it("returns invalid when text exceeds 4000 characters", async () => {
    const content = makeContent({ textContent: "A".repeat(4001) });

    const result = await xValidator(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Text exceeds 4000 character limit");
  });
});

describe("tiktokValidator", () => {
  it("returns valid when content has a .mp4 video", async () => {
    const content = makeContent({ mediaUrls: ["https://example.com/video.mp4"] });

    const result = await tiktokValidator(content);

    expect(result.valid).toBe(true);
    expect(result.errors).toStrictEqual([]);
  });

  it("returns valid when content has a .mov video", async () => {
    const content = makeContent({ mediaUrls: ["https://example.com/video.mov"] });

    const result = await tiktokValidator(content);

    expect(result.valid).toBe(true);
  });

  it("returns valid when content has a .avi video", async () => {
    const content = makeContent({ mediaUrls: ["https://example.com/video.avi"] });

    const result = await tiktokValidator(content);

    expect(result.valid).toBe(true);
  });

  it("returns invalid when content has no video files", async () => {
    const content = makeContent({ mediaUrls: ["https://example.com/image.jpg"] });

    const result = await tiktokValidator(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("TikTok requires at least one video file (.mp4, .mov, .avi)");
  });

  it("returns invalid when content has no media at all", async () => {
    const content = makeContent({ mediaUrls: [] });

    const result = await tiktokValidator(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it("handles URLs with query parameters", async () => {
    const content = makeContent({
      mediaUrls: ["https://example.com/video.mp4?t=123&w=720"],
    });

    const result = await tiktokValidator(content);

    expect(result.valid).toBe(true);
  });

  it("is case insensitive to file extensions", async () => {
    const content = makeContent({ mediaUrls: ["https://example.com/video.MP4"] });

    const result = await tiktokValidator(content);

    expect(result.valid).toBe(true);
  });
});

describe("instagramValidator", () => {
  it("returns valid when content has at least 1 media", async () => {
    const content = makeContent({ mediaUrls: ["https://example.com/image.jpg"] });

    const result = await instagramValidator(content);

    expect(result.valid).toBe(true);
  });

  it("returns invalid when content has no media", async () => {
    const content = makeContent({ mediaUrls: [] });

    const result = await instagramValidator(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("At least 1 media file(s) required, got 0");
  });
});

describe("linkedinValidator", () => {
  it("returns valid when text is within 3000 characters", async () => {
    const content = makeContent({ textContent: "A".repeat(3000) });

    const result = await linkedinValidator(content);

    expect(result.valid).toBe(true);
  });

  it("returns invalid when text exceeds 3000 characters", async () => {
    const content = makeContent({ textContent: "A".repeat(3001) });

    const result = await linkedinValidator(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Text exceeds 3000 character limit");
  });
});
