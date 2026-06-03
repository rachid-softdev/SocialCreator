/**
 * Tests for API middleware
 * - Can be imported
 * - Has correct shape and exports
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing the module
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/rate-limit-redis", () => ({
  withRateLimit: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Map()),
}));

import { NextResponse } from "next/server";
import { withApiMiddleware } from "../api-middleware";

describe("API Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("withApiMiddleware", () => {
    it("should export withApiMiddleware as a function", () => {
      expect(typeof withApiMiddleware).toBe("function");
    });

    it("should return a function (wrapped handler)", () => {
      const handler = async () => new NextResponse("ok", { status: 200 });
      const wrapped = withApiMiddleware(handler);
      expect(typeof wrapped).toBe("function");
    });
  });
});
