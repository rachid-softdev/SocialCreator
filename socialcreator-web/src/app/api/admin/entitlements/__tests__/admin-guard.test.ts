import { beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted for shared references in hoisted mock factories
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

// Mock downstream dependencies so imports resolve
vi.mock("@/lib/prisma", () => ({
  prisma: {
    plan: { findMany: vi.fn(), count: vi.fn() },
    feature: { findMany: vi.fn(), count: vi.fn() },
    entitlementOverride: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/entitlements/repository", () => ({
  getEntitlementRepository: vi.fn(() => ({
    createOverride: vi.fn(),
    deleteOverride: vi.fn(),
  })),
}));

vi.mock("@/lib/entitlements/downgrade", () => ({
  getDowngradeService: vi.fn(() => ({
    previewDowngrade: vi.fn(),
  })),
}));

vi.mock("@/lib/entitlements/service", () => ({
  getFeatureGateService: vi.fn(() => ({
    invalidateCache: vi.fn(),
  })),
}));

import { POST as CacheInvalidatePOST } from "../cache/invalidate/[orgId]/route";
import { GET as DowngradeGET } from "../orgs/[orgId]/downgrade/route";
import { DELETE as OverrideDELETE } from "../overrides/[id]/route";
import { GET as EntitlementsGET, POST as EntitlementsPOST } from "../route";

/**
 * NOTE: The entitlement routes now properly propagate AuthError via
 * `e instanceof AuthError` checks in their catch blocks, returning
 * the correct status code (401/403) instead of a generic 500.
 */

describe("Entitlement routes - admin guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/entitlements", () => {
    it("should call requireAdmin when invoked", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const req = new Request("http://localhost:3000/api/admin/entitlements?resource=plans");
      await EntitlementsGET(req);

      expect(mockRequireAdmin).toHaveBeenCalled();
    });

    it("should return 401 when requireAdmin throws AuthError", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const req = new Request("http://localhost:3000/api/admin/entitlements?resource=plans");
      const res = await EntitlementsGET(req);
      const data = await res.json();

      // AuthError is now properly propagated with correct status code
      expect(res.status).toBe(401);
      expect(data.error).toBe("Non authentifié");
    });
  });

  describe("POST /api/admin/entitlements", () => {
    it("should call requireAdmin when invoked", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const req = new Request("http://localhost:3000/api/admin/entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await EntitlementsPOST(req);

      expect(mockRequireAdmin).toHaveBeenCalled();
    });

    it("should return 401 when requireAdmin throws AuthError", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const req = new Request("http://localhost:3000/api/admin/entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await EntitlementsPOST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Non authentifié");
    });
  });

  describe("DELETE /api/admin/entitlements/overrides/:id", () => {
    it("should call requireAdmin when invoked", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const req = new Request("http://localhost:3000/api/admin/entitlements/overrides/123", {
        method: "DELETE",
      });
      const params = Promise.resolve({ id: "123" });
      await OverrideDELETE(req, { params });

      expect(mockRequireAdmin).toHaveBeenCalled();
    });
  });

  describe("GET /api/admin/entitlements/orgs/:orgId/downgrade", () => {
    it("should call requireAdmin when invoked", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const req = new Request(
        "http://localhost:3000/api/admin/entitlements/orgs/org-1/downgrade?targetPlan=starter",
      );
      const params = Promise.resolve({ orgId: "org-1" });
      await DowngradeGET(req, { params });

      expect(mockRequireAdmin).toHaveBeenCalled();
    });
  });

  describe("POST /api/admin/entitlements/cache/invalidate/:orgId", () => {
    it("should call requireAdmin when invoked", async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError("Non authentifié", 401));

      const req = new Request(
        "http://localhost:3000/api/admin/entitlements/cache/invalidate/org-1",
        { method: "POST" },
      );
      const params = Promise.resolve({ orgId: "org-1" });
      await CacheInvalidatePOST(req, { params });

      expect(mockRequireAdmin).toHaveBeenCalled();
    });
  });
});
