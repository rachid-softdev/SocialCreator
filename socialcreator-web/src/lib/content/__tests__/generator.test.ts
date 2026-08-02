/**
 * Tests for Content Generator Service
 *
 * Verifies:
 * - Single generation
 * - Multiple count
 * - Truncation to platform maxChars
 * - JSON parse fallback
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ───────────────────────────────────────────────

const mockContentRepo = vi.hoisted(() => ({
  create: vi.fn(),
}));

const mockGenerateText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => ({
    content: mockContentRepo,
  })),
}));

vi.mock("@/lib/llm/provider", () => ({
  generateText: mockGenerateText,
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Imports (after mocks) ──────────────────────────────────────

import { generateAndSaveContent } from "../generator";

describe("Content Generator — generateAndSaveContent", () => {
  const defaultInput = {
    profileId: "profile-1",
    platform: "X" as const,
    brief: "Test brief for generation",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockContentRepo.create.mockImplementation((data: any) =>
      Promise.resolve({
        id: "generated-id",
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  });

  describe("single generation", () => {
    it("should generate and save one content item", async () => {
      mockGenerateText.mockResolvedValue({
        textContent: '{"textContent": "Hello world", "hashtags": ["#test"]}',
        model: "claude-sonnet-4-20250514",
        provider: "anthropic",
      });

      const results = await generateAndSaveContent(defaultInput);

      expect(results).toHaveLength(1);
      expect(results[0]!.textContent).toBe("Hello world");
      expect(results[0]!.hashtags).toEqual(["#test"]);
      expect(results[0]!.status).toBe("DRAFT");
      expect(mockContentRepo.create).toHaveBeenCalledTimes(1);
    });

    it("should save with correct profileId and platform", async () => {
      mockGenerateText.mockResolvedValue({
        textContent: '{"textContent": "Post content", "hashtags": []}',
        model: "claude-sonnet-4-20250514",
        provider: "anthropic",
      });

      await generateAndSaveContent(defaultInput);

      expect(mockContentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: "profile-1",
          platform: "X",
          status: "DRAFT",
        }),
      );
    });
  });

  describe("multiple count", () => {
    it("should generate multiple content items based on count", async () => {
      mockGenerateText.mockResolvedValue({
        textContent: '{"textContent": "Post", "hashtags": []}',
        model: "claude-sonnet-4-20250514",
        provider: "anthropic",
      });

      const results = await generateAndSaveContent({ ...defaultInput, count: 3 });

      expect(results).toHaveLength(3);
      expect(mockGenerateText).toHaveBeenCalledTimes(3);
      expect(mockContentRepo.create).toHaveBeenCalledTimes(3);
    });

    it("should cap count at 5", async () => {
      mockGenerateText.mockResolvedValue({
        textContent: '{"textContent": "Post", "hashtags": []}',
        model: "claude-sonnet-4-20250514",
        provider: "anthropic",
      });

      const results = await generateAndSaveContent({ ...defaultInput, count: 10 });

      expect(results).toHaveLength(5);
    });

    it("should default count to 1 when not specified", async () => {
      mockGenerateText.mockResolvedValue({
        textContent: '{"textContent": "Post", "hashtags": []}',
        model: "claude-sonnet-4-20250514",
        provider: "anthropic",
      });

      const results = await generateAndSaveContent(defaultInput);

      expect(results).toHaveLength(1);
    });
  });

  describe("truncation", () => {
    it("should truncate text to platform maxChars (X = 280)", async () => {
      const longText = "A".repeat(500);
      mockGenerateText.mockResolvedValue({
        textContent: JSON.stringify({ textContent: longText, hashtags: [] }),
        model: "claude-sonnet-4-20250514",
        provider: "anthropic",
      });

      const results = await generateAndSaveContent(defaultInput);

      expect(results[0]!.textContent.length).toBe(280);
    });

    it("should not truncate text under the limit", async () => {
      const shortText = "Short post";
      mockGenerateText.mockResolvedValue({
        textContent: JSON.stringify({ textContent: shortText, hashtags: [] }),
        model: "claude-sonnet-4-20250514",
        provider: "anthropic",
      });

      const results = await generateAndSaveContent(defaultInput);

      expect(results[0]!.textContent).toBe(shortText);
    });
  });

  describe("JSON parse fallback", () => {
    it("should handle non-JSON response by using entire text", async () => {
      mockGenerateText.mockResolvedValue({
        textContent: "Just a plain text response without JSON",
        model: "claude-sonnet-4-20250514",
        provider: "anthropic",
      });

      const results = await generateAndSaveContent(defaultInput);

      expect(results[0]!.textContent).toContain("Just a plain text response");
      expect(results[0]!.hashtags).toEqual([]);
    });

    it("should extract JSON from markdown code blocks", async () => {
      mockGenerateText.mockResolvedValue({
        textContent: '```json\n{"textContent": "From code block", "hashtags": ["#code"]}\n```',
        model: "claude-sonnet-4-20250514",
        provider: "anthropic",
      });

      const results = await generateAndSaveContent(defaultInput);

      expect(results[0]!.textContent).toBe("From code block");
      expect(results[0]!.hashtags).toContain("#code");
    });
  });
});
