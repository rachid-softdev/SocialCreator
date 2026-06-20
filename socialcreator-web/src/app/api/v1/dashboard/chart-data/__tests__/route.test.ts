/**
 * Tests for GET /api/v1/dashboard/chart-data
 *
 * Tests:
 * - Default 7 days behaviour (no `days` param)
 * - Custom days parameter (30, 1)
 * - Empty data response
 * - Edge cases: invalid string, zero, negative, very large days
 * - Error handling: repo rejection → 500
 *
 * Uses mocked dependencies — no real database needed.
 * The withApiMiddleware mock includes error handling to simulate the real middleware.
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

// Mock withApiMiddleware as pass-through with userId/request/apiVersion,
// plus error handling (try/catch → 500) matching the real middleware behaviour.
vi.mock("@/lib/api-middleware", () => {
  const withApiMiddleware = (
    handler: (
      ctx: Record<string, unknown>,
      params?: Record<string, string>,
    ) => Promise<NextResponse>,
  ) => {
    return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
      const resolvedParams = context?.params ? await context.params : {};
      try {
        return await handler(
          { userId: "user-abc-123", request, apiVersion: "v1", params: resolvedParams },
          resolvedParams,
        );
      } catch {
        return NextResponse.json(
          { error: "Internal server error", code: "INTERNAL_ERROR" },
          { status: 500 },
        );
      }
    };
  };
  return { withApiMiddleware };
});

// Repository mocks — only the publishLog repo is used by this route
const mockRepos = {
  publishLog: {
    getDailyStats: vi.fn(),
  },
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => mockRepos),
}));

// ---------------------------------------------------------------------------
// Import the route under test
// ---------------------------------------------------------------------------

import { GET } from "@/app/api/v1/dashboard/chart-data/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleDailyStats = [
  { date: "2024-01-01", published: 5, failed: 1, scheduled: 3 },
  { date: "2024-01-02", published: 3, failed: 0, scheduled: 2 },
  { date: "2024-01-03", published: 8, failed: 2, scheduled: 1 },
  { date: "2024-01-04", published: 2, failed: 1, scheduled: 0 },
  { date: "2024-01-05", published: 6, failed: 0, scheduled: 4 },
  { date: "2024-01-06", published: 4, failed: 0, scheduled: 2 },
  { date: "2024-01-07", published: 7, failed: 1, scheduled: 3 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/v1/dashboard/chart-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Success scenarios ───────────────────────────────────────

  describe("success scenarios", () => {
    it("should default to 7 days when no days param is provided", async () => {
      mockRepos.publishLog.getDailyStats.mockResolvedValue(sampleDailyStats);

      const res = await GET(createRequest("/api/v1/dashboard/chart-data"));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ data: sampleDailyStats, days: 7 });
      expect(mockRepos.publishLog.getDailyStats).toHaveBeenCalledTimes(1);
      expect(mockRepos.publishLog.getDailyStats).toHaveBeenCalledWith("user-abc-123", 7);
    });

    it("should accept a custom days parameter (?days=30)", async () => {
      const thirtyDayStats = sampleDailyStats.slice(0, 3);
      mockRepos.publishLog.getDailyStats.mockResolvedValue(thirtyDayStats);

      const res = await GET(createRequest("/api/v1/dashboard/chart-data?days=30"));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ data: thirtyDayStats, days: 30 });
      expect(mockRepos.publishLog.getDailyStats).toHaveBeenCalledWith("user-abc-123", 30);
    });

    it("should work with a single day (?days=1)", async () => {
      mockRepos.publishLog.getDailyStats.mockResolvedValue([sampleDailyStats[0]]);

      const res = await GET(createRequest("/api/v1/dashboard/chart-data?days=1"));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ data: [sampleDailyStats[0]], days: 1 });
      expect(mockRepos.publishLog.getDailyStats).toHaveBeenCalledWith("user-abc-123", 1);
    });

    it("should return empty data array when there are no stats", async () => {
      mockRepos.publishLog.getDailyStats.mockResolvedValue([]);

      const res = await GET(createRequest("/api/v1/dashboard/chart-data"));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ data: [], days: 7 });
      expect(mockRepos.publishLog.getDailyStats).toHaveBeenCalledWith("user-abc-123", 7);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────

  describe("edge cases (days parameter)", () => {
    it("should handle an invalid days param (?days=abc) without crashing", async () => {
      // parseInt("abc") returns NaN — JSON serializes NaN to null.
      // The route still calls the repo with NaN, which should not crash.
      mockRepos.publishLog.getDailyStats.mockResolvedValue([]);

      const res = await GET(createRequest("/api/v1/dashboard/chart-data?days=abc"));
      expect(res.status).toBe(200);

      const body = await res.json();
      // JSON.stringify converts NaN to null
      expect(body.days).toBeNull();
      expect(body.data).toEqual([]);
      // Called with NaN — which is what parseInt("abc", 10) produces
      expect(mockRepos.publishLog.getDailyStats).toHaveBeenCalledWith("user-abc-123", NaN);
    });

    it("should handle days=0", async () => {
      mockRepos.publishLog.getDailyStats.mockResolvedValue([]);

      const res = await GET(createRequest("/api/v1/dashboard/chart-data?days=0"));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ data: [], days: 0 });
      expect(mockRepos.publishLog.getDailyStats).toHaveBeenCalledWith("user-abc-123", 0);
    });

    it("should handle negative days (?days=-1)", async () => {
      mockRepos.publishLog.getDailyStats.mockResolvedValue([]);

      const res = await GET(createRequest("/api/v1/dashboard/chart-data?days=-1"));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ data: [], days: -1 });
      expect(mockRepos.publishLog.getDailyStats).toHaveBeenCalledWith("user-abc-123", -1);
    });

    it("should handle a very large days value (?days=999999)", async () => {
      mockRepos.publishLog.getDailyStats.mockResolvedValue([]);

      const res = await GET(createRequest("/api/v1/dashboard/chart-data?days=999999"));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ data: [], days: 999999 });
      expect(mockRepos.publishLog.getDailyStats).toHaveBeenCalledWith("user-abc-123", 999999);
    });
  });

  // ── Error handling ──────────────────────────────────────────

  describe("error handling", () => {
    it("should return 500 when the repository throws", async () => {
      const repoError = new Error("Database connection failed");
      mockRepos.publishLog.getDailyStats.mockRejectedValue(repoError);

      const res = await GET(createRequest("/api/v1/dashboard/chart-data"));
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body).toEqual({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    });
  });
});
