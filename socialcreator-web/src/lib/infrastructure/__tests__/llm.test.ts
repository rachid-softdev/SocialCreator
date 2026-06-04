/**
 * Tests for llm.ts — LLM client (Anthropic Claude) (Infrastructure)
 *
 * Focuses on:
 * - Module-level Anthropic client instantiation
 * - generateContent: sends correct prompts to Claude
 * - generateContent: parses JSON response with various formats
 * - generateContent: error handling for non-JSON responses
 *
 * NOTE: This is the infrastructure wrapper (src/lib/infrastructure/llm.ts)
 * distinct from src/lib/llm/ which has its own tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMessagesCreate = vi.hoisted(() => vi.fn());
const mockAnthropicConstructor = vi.hoisted(() =>
  vi.fn((...args: unknown[]) => {
    anthropicCtorInfo.callCount++;
    anthropicCtorInfo.args.push(args);
    return { messages: { create: mockMessagesCreate } };
  }),
);

vi.mock("@anthropic-ai/sdk", () => ({
  default: mockAnthropicConstructor,
}));

// Track constructor call count and args outside mock system (clearAllMocks-safe)
const anthropicCtorInfo = vi.hoisted(() => ({ callCount: 0, args: [] as unknown[] }));

// withRetry pass-through: execute the function directly, no actual retry
vi.mock("@/lib/retry", () => ({
  withRetry: vi.fn((fn: () => unknown) => fn()),
}));

import { generateContent } from "../llm";

describe("LLM infrastructure wrapper (Claude)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Initialization
  // ============================================

  describe("initialization", () => {
    it("creates the Anthropic client on module load with correct timeout", () => {
      // Use hoisted counter/args because vi.clearAllMocks() in beforeEach clears mock call history
      expect(anthropicCtorInfo.callCount).toBe(1);
      expect(anthropicCtorInfo.args[0]).toEqual([{ timeout: 60000 }]);
    });
  });

  // ============================================
  // generateContent
  // ============================================

  describe("generateContent", () => {
    const systemPrompt = "You are a helpful assistant.";
    const userPrompt = "Generate content about AI.";

    it("sends correct prompts to Claude and returns parsed result", async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              textContent: "AI is transforming industries.",
              hashtags: ["#AI", "#technology"],
              hook: "The future is here",
            }),
          },
        ],
      });

      const result = await generateContent(systemPrompt, userPrompt);

      expect(result.textContent).toBe("AI is transforming industries.");
      expect(result.hashtags).toEqual(["#AI", "#technology"]);
      expect(result.hook).toBe("The future is here");
    });

    it("calls Claude with the correct model and parameters", async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: "text", text: '{"textContent":"test","hashtags":[]}' }],
      });

      await generateContent(systemPrompt, userPrompt);

      expect(mockMessagesCreate).toHaveBeenCalledWith({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        temperature: 0.8,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
    });

    it("strips markdown code blocks before parsing JSON", async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: '```json\n{"textContent":"Hello","hashtags":["#test"]}\n```',
          },
        ],
      });

      const result = await generateContent(systemPrompt, userPrompt);

      expect(result.textContent).toBe("Hello");
      expect(result.hashtags).toEqual(["#test"]);
    });

    it("falls back to regex extraction when direct JSON parse fails", async () => {
      // Response has extra text but contains a JSON object
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: 'Here is your content: {"textContent":"Extracted via regex","hashtags":["#regex"]}',
          },
        ],
      });

      const result = await generateContent(systemPrompt, userPrompt);

      expect(result.textContent).toBe("Extracted via regex");
      expect(result.hashtags).toEqual(["#regex"]);
    });

    it("returns empty text when content type is not text", async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: "image", source: { type: "base64" } }],
      });

      // First JSON.parse fails on empty string, then regex fails too
      await expect(generateContent(systemPrompt, userPrompt)).rejects.toThrow(
        "Failed to parse Claude response as JSON",
      );
    });

    it("throws when response contains no JSON at all", async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: "This is a plain text response without any JSON.",
          },
        ],
      });

      await expect(generateContent(systemPrompt, userPrompt)).rejects.toThrow(
        "Failed to parse Claude response as JSON",
      );
    });

    it("extracts JSON with nested braces correctly", async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: 'Some prefix {"textContent":"Nested {braces} here","hashtags":["#cool"]} suffix',
          },
        ],
      });

      const result = await generateContent(systemPrompt, userPrompt);

      expect(result.textContent).toBe("Nested {braces} here");
      expect(result.hashtags).toEqual(["#cool"]);
    });

    it("handles empty hashtags array gracefully", async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({ textContent: "No hashtags", hashtags: [] }),
          },
        ],
      });

      const result = await generateContent(systemPrompt, userPrompt);

      expect(result.textContent).toBe("No hashtags");
      expect(result.hashtags).toEqual([]);
      expect(result.hook).toBeUndefined();
    });
  });
});
