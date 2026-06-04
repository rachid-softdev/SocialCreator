/**
 * Tests for general utility functions (utils.ts)
 * - cn: class name merging utility
 * - Re-exports from @socialcreator/utils
 */

import { describe, expect, it, vi } from "vitest";

// Mock tailwind-merge to avoid dependency on tailwind config
vi.mock("tailwind-merge", () => ({
  twMerge: vi.fn((...classes: string[]) => classes.join(" ").trim()),
}));

// Mock @socialcreator/utils for the re-exported functions
const mockFormatDate = vi.fn((d: Date | string) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
});
const mockFormatDateTime = vi.fn((d: Date | string) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
});
const mockFormatDuration = vi.fn((ms: number) => {
  if (ms < 1000) return "<1s";
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}min`;
});
const mockStartOfDayUTC = vi.fn((d: Date) => {
  const result = new Date(d);
  result.setUTCHours(0, 0, 0, 0);
  return result;
});

vi.mock("@socialcreator/utils", () => ({
  formatDate: mockFormatDate,
  formatDateTime: mockFormatDateTime,
  formatDuration: mockFormatDuration,
  hashContent: vi.fn((content: string) => {
    // Simple deterministic hash for testing
    let hash = "";
    for (let i = 0; i < 64; i++) {
      hash += ((content.charCodeAt(i % content.length) + i) % 16).toString(16);
    }
    return hash;
  }),
  startOfDayUTC: mockStartOfDayUTC,
}));

describe("cn", () => {
  it("should join class names", async () => {
    const { cn } = await import("../utils");
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("should handle conditional classes", async () => {
    const { cn } = await import("../utils");
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("should handle array of classes", async () => {
    const { cn } = await import("../utils");
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("should handle nested arrays", async () => {
    const { cn } = await import("../utils");
    expect(cn("base", ["foo", ["bar"]])).toBe("base foo bar");
  });

  it("should filter out falsy values", async () => {
    const { cn } = await import("../utils");
    expect(cn("a", undefined, "b", null, "c", false, "d")).toBe("a b c d");
  });

  it("should return empty string for no inputs", async () => {
    const { cn } = await import("../utils");
    expect(cn()).toBe("");
  });

  it("should handle object syntax (clsx style)", async () => {
    const { cn } = await import("../utils");
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });

  it("should merge tailwind classes via twMerge", async () => {
    const { cn } = await import("../utils");
    // twMerge is mocked to just join strings with spaces
    const result = cn("px-4 py-2", "px-6");
    expect(result).toContain("px-4");
    expect(result).toContain("py-2");
    expect(result).toContain("px-6");
  });
});

describe("re-exports from @socialcreator/utils", () => {
  it("should re-export formatDate", async () => {
    const { formatDate } = await import("../utils");
    expect(formatDate).toBeDefined();
    expect(typeof formatDate).toBe("function");
  });

  it("should re-export formatDateTime", async () => {
    const { formatDateTime } = await import("../utils");
    expect(formatDateTime).toBeDefined();
    expect(typeof formatDateTime).toBe("function");
  });

  it("should re-export formatDuration", async () => {
    const { formatDuration } = await import("../utils");
    expect(formatDuration).toBeDefined();
    expect(typeof formatDuration).toBe("function");
  });

  it("should re-export hashContent", async () => {
    const { hashContent } = await import("../utils");
    expect(hashContent).toBeDefined();
    expect(typeof hashContent).toBe("function");
  });

  it("should re-export startOfDayUTC", async () => {
    const { startOfDayUTC } = await import("../utils");
    expect(startOfDayUTC).toBeDefined();
    expect(typeof startOfDayUTC).toBe("function");
  });
});
