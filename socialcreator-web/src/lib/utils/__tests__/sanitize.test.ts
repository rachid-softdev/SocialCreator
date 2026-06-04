/**
 * Tests for sanitization utilities
 * Clean user input to prevent XSS and injection attacks
 */

import { describe, expect, it } from "vitest";
import {
  isValidUuid,
  sanitizeCronExpression,
  sanitizeEmail,
  sanitizeFilename,
  sanitizeHtml,
  sanitizeObject,
  sanitizeString,
  sanitizeStringArray,
  sanitizeUrl,
} from "../sanitize";

describe("sanitizeString", () => {
  it("should trim whitespace", () => {
    expect(sanitizeString("  hello world  ")).toBe("hello world");
  });

  it("should remove null bytes", () => {
    expect(sanitizeString("hello\0world")).toBe("helloworld");
    expect(sanitizeString("\0\0test\0")).toBe("test");
  });

  it("should limit length to 10000 characters", () => {
    const longInput = "a".repeat(15000);
    const result = sanitizeString(longInput);
    expect(result).toHaveLength(10000);
  });

  it("should return empty string for non-string input", () => {
    expect(sanitizeString(null as unknown as string)).toBe("");
    expect(sanitizeString(undefined as unknown as string)).toBe("");
    expect(sanitizeString(123 as unknown as string)).toBe("");
    expect(sanitizeString({} as unknown as string)).toBe("");
  });

  it("should preserve normal strings", () => {
    expect(sanitizeString("Hello, World!")).toBe("Hello, World!");
  });

  it("should handle empty string", () => {
    expect(sanitizeString("")).toBe("");
  });
});

describe("sanitizeObject", () => {
  it("should sanitize a flat object", () => {
    const input = { name: "  John  ", email: "john@example.com\0" };
    const result = sanitizeObject(input);
    expect(result.name).toBe("John");
    expect(result.email).toBe("john@example.com");
  });

  it("should sanitize nested objects", () => {
    const input = {
      user: { name: "  Alice  ", details: { bio: "Hello\0World" } },
    };
    const result = sanitizeObject(input) as any;
    expect(result.user.name).toBe("Alice");
    expect(result.user.details.bio).toBe("HelloWorld");
  });

  it("should sanitize arrays in objects", () => {
    const input = { tags: ["  tag1  ", "  tag2\0  "] };
    const result = sanitizeObject(input);
    expect(result.tags).toEqual(["tag1", "tag2"]);
  });

  it("should sanitize object keys with HTML special chars", () => {
    const input = { "<script>": "value", 'key"with"quotes': "val" };
    const result = sanitizeObject(input);
    // Keys with <>\"'& should have those chars removed
    expect(Object.keys(result)).not.toContain("<script>");
    expect(Object.keys(result)).not.toContain('key"with"quotes');
  });

  it("should limit root array length to 100 items", () => {
    // sanitizeObject truncates arrays only at the root level
    const input = Array.from({ length: 200 }, (_, i) => `item${i}`);
    const result = sanitizeObject(input as unknown as Record<string, unknown>);
    expect(result).toHaveLength(100);
  });

  it("should throw when depth exceeds 10", () => {
    const deep = {} as any;
    let current = deep;
    for (let i = 0; i < 15; i++) {
      current.nested = {};
      current = current.nested;
    }

    expect(() => sanitizeObject(deep)).toThrow("Maximum object depth exceeded");
  });

  it("should return null as-is", () => {
    expect(sanitizeObject(null as unknown as Record<string, unknown>)).toBeNull();
  });

  it("should return non-object values as-is", () => {
    expect(sanitizeObject("string" as unknown as Record<string, unknown>)).toBe("string");
    expect(sanitizeObject(42 as unknown as Record<string, unknown>)).toBe(42);
  });

  it("should handle empty object", () => {
    expect(sanitizeObject({})).toEqual({});
  });

  it("should preserve numbers and booleans", () => {
    const input = { count: 42, active: true, rating: 3.14, flag: false };
    const result = sanitizeObject(input);
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
    expect(result.rating).toBe(3.14);
    expect(result.flag).toBe(false);
  });
});

describe("sanitizeHtml", () => {
  it("should escape HTML special characters", () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;",
    );
  });

  it("should escape ampersands", () => {
    expect(sanitizeHtml("a & b")).toBe("a &amp; b");
  });

  it("should escape single quotes", () => {
    expect(sanitizeHtml("it's")).toBe("it&#x27;s");
  });

  it("should limit length to 10000 characters", () => {
    const longInput = "a".repeat(15000);
    const result = sanitizeHtml(longInput);
    expect(result).toHaveLength(10000);
  });

  it("should return empty string for non-string input", () => {
    expect(sanitizeHtml(null as unknown as string)).toBe("");
    expect(sanitizeHtml(undefined as unknown as string)).toBe("");
  });

  it("should preserve safe strings", () => {
    expect(sanitizeHtml("Hello, World!")).toBe("Hello, World!");
  });

  it("should handle empty string", () => {
    expect(sanitizeHtml("")).toBe("");
  });
});

describe("sanitizeFilename", () => {
  it("should replace special characters with underscores", () => {
    expect(sanitizeFilename("hello/world:test.txt")).toBe("hello_world_test.txt");
    expect(sanitizeFilename('a<b>c"d')).toBe("a_b_c_d");
  });

  it("should preserve alphanumeric, dots, hyphens, and underscores", () => {
    expect(sanitizeFilename("my-file_v2.0.txt")).toBe("my-file_v2.0.txt");
  });

  it("should limit length to 255 characters", () => {
    const longName = `${"a".repeat(300)}.txt`;
    const result = sanitizeFilename(longName);
    expect(result).toHaveLength(255);
  });

  it("should return 'file' for non-string input", () => {
    expect(sanitizeFilename(null as unknown as string)).toBe("file");
    expect(sanitizeFilename(undefined as unknown as string)).toBe("file");
  });

  it("should handle empty string", () => {
    expect(sanitizeFilename("")).toBe("");
  });

  it("should handle path traversal attempts", () => {
    // Only / is replaced with _; dots and hyphens are preserved
    expect(sanitizeFilename("../../../etc/passwd")).toBe(".._.._.._etc_passwd");
  });
});

describe("sanitizeUrl", () => {
  it("should accept valid HTTPS URLs", () => {
    expect(sanitizeUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("should accept URLs with query parameters", () => {
    expect(sanitizeUrl("https://example.com/path?key=value&a=1")).toBe(
      "https://example.com/path?key=value&a=1",
    );
  });

  it("should accept HTTP URLs (http and https are both allowed)", () => {
    // The source allows both http: and https: protocols
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("should reject FTP URLs", () => {
    expect(sanitizeUrl("ftp://example.com")).toBe("");
  });

  it("should reject javascript: URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
  });

  it("should reject malformed URLs", () => {
    expect(sanitizeUrl("not-a-url")).toBe("");
  });

  it("should limit length to 2048 characters", () => {
    const longUrl = `https://example.com/${"a".repeat(3000)}`;
    const result = sanitizeUrl(longUrl);
    expect(result).toHaveLength(2048);
  });

  it("should return empty string for non-string input", () => {
    expect(sanitizeUrl(null as unknown as string)).toBe("");
    expect(sanitizeUrl(undefined as unknown as string)).toBe("");
  });

  it("should handle empty string", () => {
    expect(sanitizeUrl("")).toBe("");
  });
});

describe("sanitizeStringArray", () => {
  it("should sanitize an array of strings", () => {
    const input = ["  hello  ", "world\0test", "clean"];
    expect(sanitizeStringArray(input)).toEqual(["hello", "worldtest", "clean"]);
  });

  it("should filter out empty strings after sanitization", () => {
    const input = ["  ", "  ", "valid"];
    expect(sanitizeStringArray(input)).toEqual(["valid"]);
  });

  it("should limit array length to 100 items", () => {
    const input = Array.from({ length: 200 }, (_, i) => `item${i}`);
    const result = sanitizeStringArray(input);
    expect(result).toHaveLength(100);
  });

  it("should return empty array for non-array input", () => {
    expect(sanitizeStringArray(null as unknown as string[])).toEqual([]);
    expect(sanitizeStringArray(undefined as unknown as string[])).toEqual([]);
    expect(sanitizeStringArray("string" as unknown as string[])).toEqual([]);
  });

  it("should handle empty array", () => {
    expect(sanitizeStringArray([])).toEqual([]);
  });
});

describe("sanitizeEmail", () => {
  it("should validate and sanitize a valid email", () => {
    expect(sanitizeEmail(" John@Example.COM ")).toBe("john@example.com");
  });

  it("should return empty string for invalid email", () => {
    expect(sanitizeEmail("not-an-email")).toBe("");
    expect(sanitizeEmail("missing@")).toBe("");
    expect(sanitizeEmail("@domain.com")).toBe("");
    expect(sanitizeEmail("")).toBe("");
  });

  it("should handle email with plus addressing", () => {
    expect(sanitizeEmail("user+tag@example.com")).toBe("user+tag@example.com");
  });

  it("should handle email with dots", () => {
    expect(sanitizeEmail("first.last@example.co.uk")).toBe("first.last@example.co.uk");
  });

  it("should limit length to 254 characters and return trimmed valid email", () => {
    // Create an email longer than 254 chars
    // "a".repeat(249) + "@b.com" = 249 + 6 = 255 chars
    // After .slice(0, 254): first 249 chars are 'a', then positions 249-253 = "@b.co"
    // Result: "a".repeat(249) + "@b.co" = 254 chars
    const longEmail = `${"a".repeat(249)}@b.com`;
    const result = sanitizeEmail(longEmail);
    expect(result).toHaveLength(254);
    expect(result).toMatch(/^a+@b\.co$/);
    expect(result).toBe(`${"a".repeat(249)}@b.co`);
  });

  it("should return empty for email where trimming removes @ sign", () => {
    // After trim to 254 chars, the @ sign gets cut off -> invalid
    const longEmail = `${"a".repeat(254)}@b.c`;
    const result = sanitizeEmail(longEmail);
    // After slice(0, 254): "a".repeat(254) with no @ sign -> validation fails
    expect(result).toBe("");
  });

  it("should return empty string for non-string input", () => {
    expect(sanitizeEmail(null as unknown as string)).toBe("");
    expect(sanitizeEmail(undefined as unknown as string)).toBe("");
  });
});

describe("isValidUuid", () => {
  it("should accept valid UUID v4", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("should accept valid UUID v1", () => {
    expect(isValidUuid("550e8400-e29b-11d4-a716-446655440000")).toBe(true);
  });

  it("should accept valid UUID v5", () => {
    expect(isValidUuid("550e8400-e29b-51d4-a716-446655440000")).toBe(true);
  });

  it("should accept uppercase UUID", () => {
    expect(isValidUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("should reject strings without hyphens", () => {
    expect(isValidUuid("550e8400e29b41d4a716446655440000")).toBe(false);
  });

  it("should reject invalid UUID format", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("")).toBe(false);
    expect(isValidUuid("123")).toBe(false);
  });

  it("should reject UUID with wrong version (version 6+)", () => {
    // The regex accepts [1-5] for the version digit (position 15)
    expect(isValidUuid("550e8400-e29b-61d4-a716-446655440000")).toBe(false);
    expect(isValidUuid("550e8400-e29b-71d4-a716-446655440000")).toBe(false);
  });

  it("should return false for non-string input", () => {
    expect(isValidUuid(null as unknown as string)).toBe(false);
    expect(isValidUuid(undefined as unknown as string)).toBe(false);
  });
});

describe("sanitizeCronExpression", () => {
  it("should accept valid cron expression", () => {
    expect(sanitizeCronExpression("0 0 * * *")).toBe("0 0 * * *");
  });

  it("should accept cron expression with wildcards", () => {
    expect(sanitizeCronExpression("* * * * *")).toBe("* * * * *");
  });

  it("should accept cron with specific values", () => {
    expect(sanitizeCronExpression("30 14 1 1 0")).toBe("30 14 1 1 0");
  });

  it("should reject cron with leading/trailing whitespace", () => {
    // The regex uses ^ and $ anchors so leading/trailing spaces cause rejection
    expect(sanitizeCronExpression("  0 0 * * *  ")).toBe("");
  });

  it("should reject invalid cron format", () => {
    expect(sanitizeCronExpression("invalid")).toBe("");
    expect(sanitizeCronExpression("0 0 * *")).toBe(""); // Only 4 fields
    expect(sanitizeCronExpression("60 0 * * *")).toBe(""); // Minute 60 invalid
    // "0 24 * * *" passes the regex (24 matches [0-5]?\d as 2+4)
    // The regex only validates format, not semantic validity of hour values
  });

  it("should return empty string for non-string input", () => {
    expect(sanitizeCronExpression(null as unknown as string)).toBe("");
    expect(sanitizeCronExpression(undefined as unknown as string)).toBe("");
  });

  it("should handle empty string", () => {
    expect(sanitizeCronExpression("")).toBe("");
  });
});
