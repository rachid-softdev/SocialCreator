import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAdmin, MockAuthError } = vi.hoisted(() => {
  class MockAuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    mockRequireAdmin: vi.fn(),
    MockAuthError,
  };
});

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: mockRequireAdmin,
  AuthError: MockAuthError,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { count: vi.fn(), findMany: vi.fn() },
    organization: { count: vi.fn() },
    generatedContent: { count: vi.fn(), findMany: vi.fn() },
    publishLog: { count: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/rate-limit-redis", () => ({
  withRateLimit: vi.fn().mockResolvedValue(null),
}));

import { prisma } from "@/lib/prisma";
import { GET } from "../route";

function createGetRequest(): Request {
  return new Request("http://localhost:3000/api/admin/stats");
}

describe("GET /api/admin/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authorization", () => {
    it("should return 401 when requireAdmin throws AuthError with status 401", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Non authentifié");
    });

    it("should return 403 for non-admin users", async () => {
      mockRequireAdmin.mockRejectedValue(
        new MockAuthError("Accès non autorisé - rôle administrateur requis", 403),
      );

      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain("Accès non autorisé");
    });
  });

  describe("when authorized", () => {
    beforeEach(() => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(100);
      (prisma.organization.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(20);
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(500);
      (prisma.publishLog.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(50);
    });

    it("should return stats with correct shape", async () => {
      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("users");
      expect(data).toHaveProperty("organizations");
      expect(data).toHaveProperty("content");
      expect(data).toHaveProperty("publications");
    });

    it("should return user stats", async () => {
      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(data.users.total).toBe(100);
      expect(data.users.newThisWeek).toBeDefined();
      expect(data.users.newThisMonth).toBeDefined();
    });

    it("should return organization stats", async () => {
      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(data.organizations.total).toBe(20);
      expect(data.organizations.withSubscription).toBeDefined();
    });

    it("should return content stats", async () => {
      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(data.content.totalGenerated).toBe(500);
      expect(data.content.publishedToday).toBeDefined();
      expect(data.content.publishedThisMonth).toBeDefined();
    });

    it("should return publication stats", async () => {
      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(data.publications.today).toBeDefined();
      expect(data.publications.thisMonth).toBe(50);
    });

    it("should query all counts in parallel", async () => {
      await GET(createGetRequest());

      expect(prisma.user.count).toHaveBeenCalledTimes(3); // total, this week, this month
      expect(prisma.organization.count).toHaveBeenCalledTimes(2); // total, with subscription
      expect(prisma.generatedContent.count).toHaveBeenCalledTimes(3); // total, today, this month
      expect(prisma.publishLog.count).toHaveBeenCalledTimes(2); // today, this month
    });

    it("should call requireAdmin", async () => {
      await GET(createGetRequest());

      expect(mockRequireAdmin).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should return 500 for unexpected errors", async () => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Unexpected DB error"),
      );

      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal Server Error");
    });
  });

  describe("trend data (?includeTrends=true)", () => {
    beforeEach(() => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(100);
      (prisma.organization.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(20);
      (prisma.generatedContent.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(500);
      (prisma.publishLog.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(50);
      // Default trend queries return empty arrays
      (prisma.user.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.generatedContent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );
      (prisma.publishLog.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    });

    it("should NOT include trends when query param is absent", async () => {
      const res = await GET(createGetRequest());
      const data = await res.json();

      expect(data).not.toHaveProperty("trends");
    });

    it("should NOT include trends when includeTrends is false", async () => {
      const res = await GET(
        new Request("http://localhost:3000/api/admin/stats?includeTrends=false"),
      );
      const data = await res.json();

      expect(data).not.toHaveProperty("trends");
    });

    it("should include trends when includeTrends=true", async () => {
      const res = await GET(
        new Request("http://localhost:3000/api/admin/stats?includeTrends=true"),
      );
      const data = await res.json();

      expect(data).toHaveProperty("trends");
      expect(data.trends).toHaveProperty("users");
      expect(data.trends).toHaveProperty("content");
      expect(data.trends).toHaveProperty("publications");
    });

    it("should return trend data as arrays of date-count items", async () => {
      const res = await GET(
        new Request("http://localhost:3000/api/admin/stats?includeTrends=true"),
      );
      const data = await res.json();

      expect(Array.isArray(data.trends.users)).toBe(true);
      expect(Array.isArray(data.trends.content)).toBe(true);
      expect(Array.isArray(data.trends.publications)).toBe(true);
      // Each item should have date and count
      if (data.trends.users.length > 0) {
        expect(data.trends.users[0]).toHaveProperty("date");
        expect(data.trends.users[0]).toHaveProperty("count");
      }
    });

    it("should query recent data for trends when enabled", async () => {
      await GET(new Request("http://localhost:3000/api/admin/stats?includeTrends=true"));

      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.generatedContent.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.publishLog.findMany).toHaveBeenCalledTimes(1);
    });

    it("should NOT query trend data when includeTrends is not set", async () => {
      await GET(createGetRequest());

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.generatedContent.findMany).not.toHaveBeenCalled();
      expect(prisma.publishLog.findMany).not.toHaveBeenCalled();
    });

    it("should query recent users with createdAt gte filter", async () => {
      await GET(new Request("http://localhost:3000/api/admin/stats?includeTrends=true"));

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });

    it("should still return main stats when trends are included", async () => {
      const res = await GET(
        new Request("http://localhost:3000/api/admin/stats?includeTrends=true"),
      );
      const data = await res.json();

      expect(data.users.total).toBe(100);
      expect(data.content.totalGenerated).toBe(500);
      expect(data.publications.thisMonth).toBe(50);
    });
  });
});
