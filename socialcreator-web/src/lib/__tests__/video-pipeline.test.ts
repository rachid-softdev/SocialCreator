import { describe, expect, it, vi } from "vitest";
import { identifySegments } from "../video-pipeline";

// Mock generateContent
vi.mock("../llm", () => ({
  generateContent: vi.fn(),
}));

import { generateContent } from "../llm";

describe("identifySegments", () => {
  it("should return parsed segments when LLM returns valid JSON", async () => {
    vi.mocked(generateContent).mockResolvedValueOnce({
      segments: [
        { start: 0, end: 45, reason: "Strong opening hook", hook: "Did you know..." },
        { start: 60, end: 120, reason: "Key insight", hook: "Here's the thing..." },
      ],
    } as any);

    const segments = await identifySegments("transcript text here");
    expect(segments).toHaveLength(2);
    expect(segments[0]!.start).toBe(0);
    expect(segments[0]!.end).toBe(45);
    expect(segments[0]!.reason).toBe("Strong opening hook");
  });

  it("should throw when LLM returns invalid segments format", async () => {
    vi.mocked(generateContent).mockResolvedValueOnce({
      segments: "not-an-array",
    } as any);

    await expect(identifySegments("test transcript")).rejects.toThrow("Failed to parse");
  });

  it("should throw when LLM returns missing segments field", async () => {
    vi.mocked(generateContent).mockResolvedValueOnce({
      wrong: "format",
    } as any);

    await expect(identifySegments("test")).rejects.toThrow();
  });

  it("should throw when LLM returns empty segments array", async () => {
    vi.mocked(generateContent).mockResolvedValueOnce({
      segments: [],
    } as any);

    await expect(identifySegments("test")).rejects.toThrow();
  });

  it("should throw when segment has negative start", async () => {
    vi.mocked(generateContent).mockResolvedValueOnce({
      segments: [{ start: -1, end: 30, reason: "test", hook: "test" }],
    } as any);

    await expect(identifySegments("test")).rejects.toThrow();
  });
});
