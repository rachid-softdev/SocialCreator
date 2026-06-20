/**
 * Unit tests for GET /api/v1/publish-logs
 *
 * Tests paginated publish history for current user or by profileId.
 *
 * Uses mocked dependencies — no real database needed.
 * Follows the exact mock pattern from src/app/api/v1/__tests__/routes.test.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit-redis", () => ({ withRateLimit: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock prisma for routes that use it directly (publishLog.count)
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    publishLog: {
      count: vi.fn(),
    },
  },
}));

// Mock withApiMiddleware to be a pass-through for handler tests.
// The middleware's auth/rate-limit behavior is tested separately
// in api-middleware.integration.test.ts.
// Includes a catch block to simulate the real middleware's error handling
// for the DB error propagation test.
vi.mock("@/lib/api-middleware", () => {
  const withApiMiddleware = (handler: (ctx: any) => Promise<NextResponse>) => {
    return async (
      request: NextRequest,
      _context?: { params?: Promise<Record<string, string>> },
    ) => {
      try {
        return await handler({ userId: "user-abc-123", request, apiVersion: "v1", params: {} });
      } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    };
  };
  return { withApiMiddleware };
});

// Repository mocks
const mockPublishLogRepo = {
  findByProfileId: vi.fn(),
  findByUserId: vi.fn(),
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => ({
    publishLog: mockPublishLogRepo,
  })),
}));

// ---------------------------------------------------------------------------
// Import route handler
// ---------------------------------------------------------------------------

import { GET } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  path: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> },
): NextRequest {
  const url = `http://localhost:3000${path}`;
  const body = options?.body !== undefined ? JSON.stringify(options.body) : undefined;
  return new NextRequest(url, {
    method: options?.method ?? "GET",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body,
  });
}

function createParams(params: Record<string, string>): { params: Promise<Record<string, string>> } {
  return { params: Promise.resolve(params) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/v1/publish-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── By userId (no profileId) ──────────────────────────────

  describe("by userId (no profileId)", () => {
    it("should return paginated logs with correct structure", async () => {
      mockPublishLogRepo.findByUserId.mockResolvedValue({
        logs: [{ id: "log-1", profileId: "p-1", status: "SUCCESS" }],
        total: 5,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const res = await GET(createRequest("/api/v1/publish-logs"), createParams({}));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        logs: [{ id: "log-1", profileId: "p-1", status: "SUCCESS" }],
        totalPages: 1,
        page: 1,
        pageSize: 20,
      });
    });

    it("should pass custom page/pageSize params to repo", async () => {
      mockPublishLogRepo.findByUserId.mockResolvedValue({
        logs: [],
        total: 0,
        page: 2,
        pageSize: 10,
        totalPages: 0,
      });

      await GET(createRequest("/api/v1/publish-logs?page=2&pageSize=10"), createParams({}));

      expect(mockPublishLogRepo.findByUserId).toHaveBeenCalledWith("user-abc-123", {
        page: 2,
        pageSize: 10,
      });
    });

    it("should return empty logs structure when no logs exist", async () => {
      mockPublishLogRepo.findByUserId.mockResolvedValue({
        logs: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const res = await GET(createRequest("/api/v1/publish-logs"), createParams({}));
      const data = await res.json();

      expect(data).toEqual({
        logs: [],
        totalPages: 1,
        page: 1,
        pageSize: 20,
      });
    });

    it("should clamp pageSize to maximum of 100", async () => {
      mockPublishLogRepo.findByUserId.mockResolvedValue({
        logs: [],
        total: 0,
        page: 1,
        pageSize: 100,
        totalPages: 0,
      });

      await GET(createRequest("/api/v1/publish-logs?pageSize=200"), createParams({}));

      // Math.min(100, 200) = 100
      expect(mockPublishLogRepo.findByUserId).toHaveBeenCalledWith("user-abc-123", {
        page: 1,
        pageSize: 100,
      });
    });
  });

  // ── By profileId ──────────────────────────────────────────

  describe("by profileId", () => {
    it("should return logs for profile with totalPages computed from prisma count", async () => {
      const mockLogs = [{ id: "log-1", profileId: "p-1", status: "SUCCESS" }];
      mockPublishLogRepo.findByProfileId.mockResolvedValue(mockLogs);
      vi.mocked(prisma.publishLog.count).mockResolvedValue(25);

      const res = await GET(
        createRequest("/api/v1/publish-logs?profileId=p-1&pageSize=10"),
        createParams({}),
      );
      const data = await res.json();

      expect(mockPublishLogRepo.findByProfileId).toHaveBeenCalledWith("p-1", {
        page: 1,
        pageSize: 10,
      });
      expect(prisma.publishLog.count).toHaveBeenCalledWith({ where: { profileId: "p-1" } });
      expect(data).toEqual({
        logs: mockLogs,
        totalPages: 3, // Math.ceil(25 / 10) = 3
        page: 1,
        pageSize: 10,
      });
    });

    it("should return empty logs for profile when no logs exist", async () => {
      mockPublishLogRepo.findByProfileId.mockResolvedValue([]);
      vi.mocked(prisma.publishLog.count).mockResolvedValue(0);

      const res = await GET(createRequest("/api/v1/publish-logs?profileId=p-1"), createParams({}));
      const data = await res.json();

      expect(data).toEqual({
        logs: [],
        totalPages: 1, // Math.ceil(0 / 20) || 1 = 1
        page: 1,
        pageSize: 20,
      });
    });
  });

  // ── Edge cases ────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle invalid (non-numeric) page param gracefully", async () => {
      mockPublishLogRepo.findByUserId.mockResolvedValue({
        logs: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      await GET(createRequest("/api/v1/publish-logs?page=abc"), createParams({}));

      // Number("abc") = NaN → Math.max(1, NaN || 1) = 1
      expect(mockPublishLogRepo.findByUserId).toHaveBeenCalledWith("user-abc-123", {
        page: 1,
        pageSize: 20,
      });
    });

    it("should handle invalid (non-numeric) pageSize param gracefully", async () => {
      mockPublishLogRepo.findByUserId.mockResolvedValue({
        logs: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      await GET(createRequest("/api/v1/publish-logs?pageSize=abc"), createParams({}));

      // Number("abc") = NaN → Math.min(100, NaN || 20) = 20
      expect(mockPublishLogRepo.findByUserId).toHaveBeenCalledWith("user-abc-123", {
        page: 1,
        pageSize: 20,
      });
    });

    it("should clamp negative page to 1", async () => {
      mockPublishLogRepo.findByUserId.mockResolvedValue({
        logs: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      await GET(createRequest("/api/v1/publish-logs?page=-5"), createParams({}));

      // Math.max(1, -5) = 1
      expect(mockPublishLogRepo.findByUserId).toHaveBeenCalledWith("user-abc-123", {
        page: 1,
        pageSize: 20,
      });
    });

    it("should return 500 when DB error propagates from repo", async () => {
      mockPublishLogRepo.findByUserId.mockRejectedValue(new Error("Database connection failed"));

      const res = await GET(createRequest("/api/v1/publish-logs"), createParams({}));
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
