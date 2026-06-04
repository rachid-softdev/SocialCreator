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
    user: { count: vi.fn() },
    organization: { count: vi.fn() },
    generatedContent: { count: vi.fn() },
    publishLog: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "../route";

describe("GET /api/admin/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authorization", () => {
    it("should return 401 when requireAdmin throws AuthError with status 401", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Non authentifié");
    });

    it("should return 403 for non-admin users", async () => {
      mockRequireAdmin.mockRejectedValue(
        new MockAuthError("Accès non autorisé - rôle administrateur requis", 403),
      );

      const res = await GET();
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
      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("users");
      expect(data).toHaveProperty("organizations");
      expect(data).toHaveProperty("content");
      expect(data).toHaveProperty("publications");
    });

    it("should return user stats", async () => {
      const res = await GET();
      const data = await res.json();

      expect(data.users.total).toBe(100);
      expect(data.users.activeThisMonth).toBeDefined();
      expect(data.users.newThisWeek).toBeDefined();
      expect(data.users.newThisMonth).toBeDefined();
    });

    it("should return organization stats", async () => {
      const res = await GET();
      const data = await res.json();

      expect(data.organizations.total).toBe(20);
      expect(data.organizations.withSubscription).toBeDefined();
    });

    it("should return content stats", async () => {
      const res = await GET();
      const data = await res.json();

      expect(data.content.totalGenerated).toBe(500);
      expect(data.content.publishedToday).toBeDefined();
      expect(data.content.publishedThisMonth).toBeDefined();
    });

    it("should return publication stats", async () => {
      const res = await GET();
      const data = await res.json();

      expect(data.publications.today).toBeDefined();
      expect(data.publications.thisMonth).toBe(50);
    });

    it("should query all counts in parallel", async () => {
      await GET();

      expect(prisma.user.count).toHaveBeenCalledTimes(3); // total, this week, this month
      expect(prisma.organization.count).toHaveBeenCalledTimes(2); // total, with subscription
      expect(prisma.generatedContent.count).toHaveBeenCalledTimes(3); // total, today, this month
      expect(prisma.publishLog.count).toHaveBeenCalledTimes(2); // today, this month
    });

    it("should call requireAdmin", async () => {
      await GET();

      expect(mockRequireAdmin).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should return 500 for unexpected errors", async () => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
      (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Unexpected DB error"),
      );

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal Server Error");
    });
  });
});
