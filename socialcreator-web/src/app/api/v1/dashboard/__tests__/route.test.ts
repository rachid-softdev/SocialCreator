/**
 * Unit tests for GET /api/v1/dashboard
 *
 * Verifies:
 * - Aggregated stats (profiles, totalContents, totalPublished, todayPublishes)
 * - Recent activity logs for the user
 * - Edge cases: no profiles, no content, single profile, many profiles, empty logs
 * - Error propagation when repositories throw
 *
 * Uses mocked dependencies — no real database needed.
 * withApiMiddleware is mocked as pass-through (auth/rate-limit tested separately).
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit-redis", () => ({ withRateLimit: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock prisma for direct publishLog.count usage
vi.mock("@/lib/prisma", () => ({
  prisma: {
    publishLog: {
      count: vi.fn(),
    },
  },
}));

// Mock withApiMiddleware as a pass-through so route handlers are tested
// in isolation. Auth/rate-limit behavior is tested separately in
// api-middleware.integration.test.ts.
vi.mock("@/lib/api-middleware", () => {
  const withApiMiddleware = (
    handler: (ctx: {
      userId: string;
      request: NextRequest;
      apiVersion: string;
    }) => Promise<Response>,
  ) => {
    return async (request: NextRequest) => {
      return handler({ userId: "user-abc-123", request, apiVersion: "v1" });
    };
  };
  return { withApiMiddleware };
});

// Repository mocks
const mockRepos = {
  profile: { findByUserId: vi.fn() },
  content: { findByProfileId: vi.fn() },
  publishLog: { findByUserId: vi.fn() },
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => mockRepos),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks — vi.mock is hoisted, but keeping conventional order)
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { GET } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/v1/dashboard");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/v1/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Success scenarios ─────────────────────────────────────

  describe("success scenarios", () => {
    it("should return aggregated stats for a user with 2 profiles and some content", async () => {
      mockRepos.profile.findByUserId.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
      // 4 content calls: p1 total, p2 total, p1 published, p2 published
      mockRepos.content.findByProfileId.mockImplementation(
        (_profileId: string, opts?: Record<string, unknown>) => {
          if (opts?.status === "PUBLISHED") {
            return Promise.resolve({ total: 3 });
          }
          return Promise.resolve({ total: 5 });
        },
      );
      vi.mocked(prisma.publishLog.count).mockResolvedValue(2);
      const recentLogs = [
        { id: "log-1", profileId: "p1", platform: "X", success: true },
        { id: "log-2", profileId: "p2", platform: "LinkedIn", success: true },
      ];
      mockRepos.publishLog.findByUserId.mockResolvedValue({ logs: recentLogs });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toEqual({
        profiles: 2,
        totalContents: 10,
        totalPublished: 6,
        todayPublishes: 4,
      });
      expect(data.recentActivity).toEqual(recentLogs);
    });

    it("should return all-zero stats for a new user with no profiles", async () => {
      mockRepos.profile.findByUserId.mockResolvedValue([]);
      mockRepos.publishLog.findByUserId.mockResolvedValue({ logs: [] });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toEqual({
        profiles: 0,
        totalContents: 0,
        totalPublished: 0,
        todayPublishes: 0,
      });
      expect(data.recentActivity).toEqual([]);

      // No content or publishLog queries should include profileIds
      expect(mockRepos.content.findByProfileId).not.toHaveBeenCalled();
      expect(prisma.publishLog.count).not.toHaveBeenCalled();

      // publishLog.findByUserId is always called for the user's recent activity
      expect(mockRepos.publishLog.findByUserId).toHaveBeenCalledWith("user-abc-123", {
        pageSize: 10,
      });
    });

    it("should return zero content stats when profiles exist but have no content", async () => {
      mockRepos.profile.findByUserId.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
      mockRepos.content.findByProfileId.mockResolvedValue({ total: 0 });
      vi.mocked(prisma.publishLog.count).mockResolvedValue(0);
      mockRepos.publishLog.findByUserId.mockResolvedValue({ logs: [] });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toEqual({
        profiles: 2,
        totalContents: 0,
        totalPublished: 0,
        todayPublishes: 0,
      });
      expect(data.recentActivity).toEqual([]);
    });
  });

  // ── Edge cases ────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle a single profile correctly", async () => {
      mockRepos.profile.findByUserId.mockResolvedValue([{ id: "p1" }]);

      // Return different values for total vs published to verify both queries
      mockRepos.content.findByProfileId.mockImplementation(
        (_profileId: string, opts?: Record<string, unknown>) => {
          const total = opts?.status === "PUBLISHED" ? 3 : 7;
          return Promise.resolve({ total });
        },
      );
      vi.mocked(prisma.publishLog.count).mockResolvedValue(2);
      mockRepos.publishLog.findByUserId.mockResolvedValue({
        logs: [{ id: "log-1", profileId: "p1", success: true }],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toEqual({
        profiles: 1,
        totalContents: 7,
        totalPublished: 3,
        todayPublishes: 2,
      });

      // Verify all queries used the single profileId "p1"
      expect(mockRepos.content.findByProfileId).toHaveBeenCalledWith("p1", { pageSize: 1 });
      expect(mockRepos.content.findByProfileId).toHaveBeenCalledWith("p1", {
        status: "PUBLISHED",
        pageSize: 1,
      });
      expect(prisma.publishLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ profileId: "p1" }),
        }),
      );
    });

    it("should query all profileIds when user has 3 profiles", async () => {
      mockRepos.profile.findByUserId.mockResolvedValue([{ id: "p1" }, { id: "p2" }, { id: "p3" }]);
      mockRepos.content.findByProfileId.mockResolvedValue({ total: 2 });
      vi.mocked(prisma.publishLog.count).mockResolvedValue(1);
      mockRepos.publishLog.findByUserId.mockResolvedValue({ logs: [] });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toEqual({
        profiles: 3,
        totalContents: 6,
        totalPublished: 6,
        todayPublishes: 3,
      });

      // Verify the number of queries corresponds to 3 profiles
      // 3 profiles × 2 content queries (total + published) = 6
      expect(mockRepos.content.findByProfileId).toHaveBeenCalledTimes(6);
      // 3 profiles × 1 count query each
      expect(prisma.publishLog.count).toHaveBeenCalledTimes(3);
    });

    it("should return empty recentActivity when publishLog returns no logs", async () => {
      mockRepos.profile.findByUserId.mockResolvedValue([{ id: "p1" }]);
      mockRepos.content.findByProfileId.mockResolvedValue({ total: 1 });
      vi.mocked(prisma.publishLog.count).mockResolvedValue(0);
      mockRepos.publishLog.findByUserId.mockResolvedValue({ logs: [] });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(data.recentActivity).toEqual([]);
    });
  });

  // ── Error handling ────────────────────────────────────────

  describe("error handling", () => {
    it("should propagate errors when profileRepo.findByUserId throws", async () => {
      mockRepos.profile.findByUserId.mockRejectedValue(new Error("Database connection failed"));

      await expect(GET(createRequest())).rejects.toThrow("Database connection failed");
    });

    it("should propagate errors when contentRepo.findByProfileId throws", async () => {
      mockRepos.profile.findByUserId.mockResolvedValue([{ id: "p1" }]);
      mockRepos.content.findByProfileId.mockRejectedValue(new Error("Content query failed"));

      await expect(GET(createRequest())).rejects.toThrow("Content query failed");
    });

    it("should propagate errors when prisma.publishLog.count throws", async () => {
      mockRepos.profile.findByUserId.mockResolvedValue([{ id: "p1" }]);
      mockRepos.content.findByProfileId.mockResolvedValue({ total: 1 });
      vi.mocked(prisma.publishLog.count).mockRejectedValue(new Error("Prisma query failed"));

      await expect(GET(createRequest())).rejects.toThrow("Prisma query failed");
    });

    it("should propagate errors when publishLogRepo.findByUserId throws", async () => {
      mockRepos.profile.findByUserId.mockResolvedValue([{ id: "p1" }]);
      mockRepos.content.findByProfileId.mockResolvedValue({ total: 1 });
      vi.mocked(prisma.publishLog.count).mockResolvedValue(0);
      mockRepos.publishLog.findByUserId.mockRejectedValue(new Error("Publish log query failed"));

      await expect(GET(createRequest())).rejects.toThrow("Publish log query failed");
    });
  });
});
