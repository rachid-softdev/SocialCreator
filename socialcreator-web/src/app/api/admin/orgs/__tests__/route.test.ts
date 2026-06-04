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
    organization: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "../route";

describe("GET /api/admin/orgs", () => {
  const mockOrgs = [
    {
      id: "org-1",
      name: "Acme Corp",
      teamId: "team-1",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      subscription: { planKey: "pro", status: "ACTIVE", cancelAtPeriodEnd: false },
      _count: { entitlementOverrides: 2 },
    },
    {
      id: "org-2",
      name: "Startup Inc",
      teamId: null,
      createdAt: new Date("2024-02-01"),
      updatedAt: new Date("2024-02-01"),
      subscription: null,
      _count: { entitlementOverrides: 0 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authorization", () => {
    it("should return 401 when requireAdmin throws AuthError", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const res = await GET(new Request("http://localhost:3000/api/admin/orgs"));
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Non authentifié");
    });

    it("should return 403 for non-admin users", async () => {
      mockRequireAdmin.mockRejectedValue(
        new MockAuthError("Accès non autorisé - rôle administrateur requis", 403),
      );

      const res = await GET(new Request("http://localhost:3000/api/admin/orgs"));

      expect(res.status).toBe(403);
    });
  });

  describe("when authorized", () => {
    beforeEach(() => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
      (prisma.organization.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockOrgs,
      );
      (prisma.organization.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    });

    it("should return orgs list with pagination", async () => {
      const res = await GET(new Request("http://localhost:3000/api/admin/orgs"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].name).toBe("Acme Corp");
      expect(data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it("should accept page and limit params", async () => {
      const res = await GET(new Request("http://localhost:3000/api/admin/orgs?page=1&limit=10"));

      expect(res.status).toBe(200);
      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });

    it("should filter by search query", async () => {
      (prisma.organization.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (prisma.organization.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockOrgs[0],
      ]);

      const res = await GET(new Request("http://localhost:3000/api/admin/orgs?search=Acme"));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { contains: "Acme", mode: "insensitive" } },
        }),
      );
    });

    it("should order by createdAt desc", async () => {
      await GET(new Request("http://localhost:3000/api/admin/orgs"));

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("should call requireAdmin", async () => {
      await GET(new Request("http://localhost:3000/api/admin/orgs"));

      expect(mockRequireAdmin).toHaveBeenCalled();
    });
  });

  describe("pagination validation", () => {
    beforeEach(() => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
      (prisma.organization.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.organization.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    });

    it("should default page to 1", async () => {
      await GET(new Request("http://localhost:3000/api/admin/orgs?page=0"));

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
    });

    it("should cap limit at 100", async () => {
      await GET(new Request("http://localhost:3000/api/admin/orgs?limit=999"));

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it("should use default limit when not specified", async () => {
      await GET(new Request("http://localhost:3000/api/admin/orgs"));

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it("should default to 1 when page is NaN", async () => {
      await GET(new Request("http://localhost:3000/api/admin/orgs?page=abc"));

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
    });

    it("should default to 1 when page is negative", async () => {
      await GET(new Request("http://localhost:3000/api/admin/orgs?page=-5"));

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
    });

    it("should default to 20 when limit is zero (falsy fallback)", async () => {
      await GET(new Request("http://localhost:3000/api/admin/orgs?limit=0"));

      // parseInt("0") => 0, and 0 is falsy so || 20 kicks in
      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it("should default to 1 when limit is negative", async () => {
      await GET(new Request("http://localhost:3000/api/admin/orgs?limit=-10"));

      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 }),
      );
    });
  });

  describe("error handling", () => {
    it("should return 500 for unexpected errors", async () => {
      mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" });
      (prisma.organization.findMany as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Unexpected DB error"),
      );

      const res = await GET(new Request("http://localhost:3000/api/admin/orgs"));
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal Server Error");
    });
  });
});
