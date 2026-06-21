/**
 * Feature Flags & Entitlements - Middleware Tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock service
const mockService = {
  hasFeature: vi.fn(),
  getLimit: vi.fn(),
  canConsume: vi.fn(),
  consume: vi.fn(),
  getAllEntitlements: vi.fn(),
  getDebugTrace: vi.fn(),
};

vi.mock("@/lib/entitlements/service", () => ({
  getFeatureGateService: () => mockService,
}));

vi.mock("@/lib/entitlements/service", () => ({
  getFeatureGateService: () => mockService,
  createFeatureNotAvailableError: (feature: string, plan: string) => ({
    error: "FEATURE_NOT_AVAILABLE",
    feature,
    planRequired: "PRO",
    currentPlan: plan,
    upgradeUrl: "/settings/billing?upgrade=true",
  }),
  createLimitReachedError: (feature: string, limit: number, used: number, resetAt: Date) => ({
    error: "LIMIT_REACHED",
    feature,
    limit,
    used,
    resetAt: resetAt.toISOString(),
    upgradeUrl: "/settings/billing?upgrade=true",
  }),
}));

describe("Entitlements Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireFeature", () => {
    it("should allow when feature is enabled", async () => {
      const { requireFeature } = await import("../middleware");

      mockService.hasFeature.mockResolvedValue(true);

      const middleware = requireFeature("EXPORT_PDF");
      const context = { orgId: "org-1" };
      const handler = vi.fn().mockResolvedValue(new Response("OK"));

      const result = await middleware(context, handler);

      expect(handler).toHaveBeenCalled();
      expect(result.status).toBe(200);
    });

    it("should deny when feature is disabled", async () => {
      const { requireFeature } = await import("../middleware");

      mockService.hasFeature.mockResolvedValue(false);
      mockService.getDebugTrace.mockResolvedValue({ planKey: "free" });

      const middleware = requireFeature("EXPORT_PDF");
      const context = { orgId: "org-1" };
      const handler = vi.fn();

      const result = await middleware(context, handler);

      expect(handler).not.toHaveBeenCalled();
      expect(result.status).toBe(403);

      const json = await result.json();
      expect(json.error).toBe("FEATURE_NOT_AVAILABLE");
    });
  });

  describe("consumeFeature", () => {
    it("should consume quota when under limit", async () => {
      const { consumeFeature } = await import("../middleware");

      mockService.hasFeature.mockResolvedValue(true);
      mockService.consume.mockResolvedValue({
        success: true,
        used: 6,
        limit: 10,
        resetAt: new Date(),
      });

      const middleware = consumeFeature("AI_GENERATIONS", 1);
      const context = { orgId: "org-1" };
      const handler = vi.fn().mockResolvedValue(new Response("OK"));

      await middleware(context, handler);

      expect(handler).toHaveBeenCalled();
      expect(mockService.consume).toHaveBeenCalledWith("org-1", "AI_GENERATIONS", 1);
    });

    it("should deny when limit reached", async () => {
      const { consumeFeature } = await import("../middleware");

      mockService.hasFeature.mockResolvedValue(true);
      mockService.consume.mockResolvedValue({
        success: false,
        used: 10,
        limit: 10,
        resetAt: new Date(),
        error: "LIMIT_REACHED",
        feature: "AI_GENERATIONS",
      });

      const middleware = consumeFeature("AI_GENERATIONS", 1);
      const context = { orgId: "org-1" };
      const handler = vi.fn();

      const result = await middleware(context, handler);

      expect(handler).not.toHaveBeenCalled();
      expect(result.status).toBe(402);

      const json = await result.json();
      expect(json.error).toBe("LIMIT_REACHED");
    });
  });

  describe("requireLimit", () => {
    it("should allow when limit is null (unlimited)", async () => {
      const { requireLimit } = await import("../middleware");

      mockService.getLimit.mockResolvedValue(null);

      const middleware = requireLimit("AI_GENERATIONS");
      const context = { orgId: "org-1" };
      const handler = vi.fn().mockResolvedValue(new Response("OK"));

      const result = await middleware(context, handler);

      expect(handler).toHaveBeenCalled();
      expect(result.status).toBe(200);
    });

    it("should allow when under limit and add headers", async () => {
      const { requireLimit } = await import("../middleware");

      mockService.getLimit.mockResolvedValue(10);
      mockService.canConsume.mockResolvedValue(true);
      mockService.getAllEntitlements.mockResolvedValue({
        usage: { AI_GENERATIONS: 3 },
        resetAt: { AI_GENERATIONS: new Date("2025-07-01") },
      });

      const middleware = requireLimit("AI_GENERATIONS");
      const context = { orgId: "org-1" };
      const handler = vi.fn().mockResolvedValue(new Response("OK"));

      const result = await middleware(context, handler);

      expect(handler).toHaveBeenCalled();
      expect(result.status).toBe(200);
    });

    it("should deny when over limit and return 402 with rate limit headers", async () => {
      const { requireLimit } = await import("../middleware");

      mockService.getLimit.mockResolvedValue(10);
      mockService.canConsume.mockResolvedValue(false);
      mockService.getAllEntitlements.mockResolvedValue({
        usage: { AI_GENERATIONS: 10 },
        resetAt: { AI_GENERATIONS: new Date("2025-07-01") },
      });

      const middleware = requireLimit("AI_GENERATIONS");
      const context = { orgId: "org-1" };
      const handler = vi.fn();

      const result = await middleware(context, handler);

      expect(handler).not.toHaveBeenCalled();
      expect(result.status).toBe(402);

      const json = await result.json();
      expect(json.error).toBe("LIMIT_REACHED");
      expect(result.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(result.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("should allow when exactly at limit (usage equals limit) with remaining header", async () => {
      const { requireLimit } = await import("../middleware");

      mockService.getLimit.mockResolvedValue(5);
      mockService.canConsume.mockResolvedValue(true);
      mockService.getAllEntitlements.mockResolvedValue({
        usage: { SOME_FEATURE: 5 },
        resetAt: { SOME_FEATURE: new Date("2025-07-01") },
      });

      const middleware = requireLimit("SOME_FEATURE");
      const context = { orgId: "org-1" };
      const handler = vi.fn().mockResolvedValue(new Response("OK"));

      const result = await middleware(context, handler);

      expect(handler).toHaveBeenCalled();
      expect(result.status).toBe(200);
      // Since getAllEntitlements returns usage:5 and limit:5 → remaining:0
      // But canConsume returned true... In this scenario, canConsume is mocked
      // so the actual header reflects entitlements.usage
      expect(result.headers.get("X-RateLimit-Remaining")).toBe("0");
    });
  });

  describe("consumeFeature — hasFeature denied path", () => {
    it("should return 403 when feature is not available", async () => {
      const { consumeFeature } = await import("../middleware");

      mockService.hasFeature.mockResolvedValue(false);
      mockService.getDebugTrace.mockResolvedValue({ planKey: "free" });

      const middleware = consumeFeature("EXPORT_PDF");
      const context = { orgId: "org-1" };
      const handler = vi.fn();

      const result = await middleware(context, handler);

      expect(handler).not.toHaveBeenCalled();
      expect(result.status).toBe(403);

      const json = await result.json();
      expect(json.error).toBe("FEATURE_NOT_AVAILABLE");
    });
  });

  describe("withEntitlements", () => {
    it("should compose multiple middleware in sequence", async () => {
      const { withEntitlements, requireFeature } = await import("../middleware");

      mockService.hasFeature.mockResolvedValue(true);

      const middleware = withEntitlements(
        requireFeature("AI_GENERATIONS"),
        async (_context, nextHandler) => {
          await nextHandler();
          return new Response("OK", { status: 200 });
        },
      );

      const context = { orgId: "org-1" };
      const handler = vi.fn().mockResolvedValue(new Response("OK"));

      const result = await middleware(context, handler);

      expect(handler).toHaveBeenCalled();
      expect(result.status).toBe(200);
    });

    it("should stop chain when first middleware fails", async () => {
      const { withEntitlements, requireFeature } = await import("../middleware");

      mockService.hasFeature.mockResolvedValue(false);
      mockService.getDebugTrace.mockResolvedValue({ planKey: "free" });

      const denyMiddleware = requireFeature("EXPORT_PDF");
      const passThrough = async (_ctx: any, next: any) => next();

      const middleware = withEntitlements(denyMiddleware, passThrough);

      const context = { orgId: "org-1" };
      const handler = vi.fn();

      const result = await middleware(context, handler);

      expect(handler).not.toHaveBeenCalled();
      expect(result.status).toBe(403);
    });
  });

  describe("withFeature wrapper", () => {
    it("should wrap Next.js handler", async () => {
      const { withFeature } = await import("../middleware");

      mockService.hasFeature.mockResolvedValue(true);

      const handler = withFeature("EXPORT_PDF", async () => {
        return new Response("Success", { status: 200 });
      });

      const request = new Request("http://localhost/api/test?orgId=org-1");

      const result = await handler(request);

      expect(result.status).toBe(200);
    });

    it("should return 401 when orgId missing", async () => {
      const { withFeature } = await import("../middleware");

      const handler = withFeature("EXPORT_PDF", async () => {
        return new Response("Success");
      });

      const request = new Request("http://localhost/api/test"); // No orgId

      const result = await handler(request);

      expect(result.status).toBe(401);
    });
  });

  describe("withLimit wrapper", () => {
    it("should wrap handler with limit check and pass through when under limit", async () => {
      const { withLimit } = await import("../middleware");

      mockService.getLimit.mockResolvedValue(10);
      mockService.canConsume.mockResolvedValue(true);
      mockService.getAllEntitlements.mockResolvedValue({
        usage: { AI_GENERATIONS: 2 },
        resetAt: { AI_GENERATIONS: new Date("2025-07-01") },
      });

      const handler = withLimit("AI_GENERATIONS", async () => {
        return new Response("Success", { status: 200 });
      });

      const request = new Request("http://localhost/api/test?orgId=org-1");
      const result = await handler(request);

      expect(result.status).toBe(200);
    });

    it("should return 401 when orgId missing", async () => {
      const { withLimit } = await import("../middleware");

      const handler = withLimit("AI_GENERATIONS", async () => {
        return new Response("Success");
      });

      const request = new Request("http://localhost/api/test");
      const result = await handler(request);

      expect(result.status).toBe(401);
    });
  });

  describe("withConsume wrapper", () => {
    it("should wrap handler with consumption and pass through when under limit", async () => {
      const { withConsume } = await import("../middleware");

      mockService.hasFeature.mockResolvedValue(true);
      mockService.consume.mockResolvedValue({
        success: true,
        used: 6,
        limit: 10,
        resetAt: new Date(),
      });

      const handler = withConsume("AI_GENERATIONS", 1, async () => {
        return new Response("Created", { status: 201 });
      });

      const request = new Request("http://localhost/api/test?orgId=org-1");
      const result = await handler(request);

      expect(result.status).toBe(201);
    });

    it("should return 401 when orgId missing", async () => {
      const { withConsume } = await import("../middleware");

      const handler = withConsume("AI_GENERATIONS", 1, async () => {
        return new Response("Created");
      });

      const request = new Request("http://localhost/api/test");
      const result = await handler(request);

      expect(result.status).toBe(401);
    });

    it("should return 403 when feature is not available", async () => {
      const { withConsume } = await import("../middleware");

      mockService.hasFeature.mockResolvedValue(false);
      mockService.getDebugTrace.mockResolvedValue({ planKey: "free" });

      const handler = withConsume("EXPORT_PDF", 1, async () => {
        return new Response("OK");
      });

      const request = new Request("http://localhost/api/test?orgId=org-1");
      const result = await handler(request);

      expect(result.status).toBe(403);
    });
  });

  describe("getOrgIdFromRequest", () => {
    it("should extract orgId from x-org-id header", async () => {
      const { getOrgIdFromRequest } = await import("../middleware");

      const request = new Request("http://localhost/api/test", {
        headers: { "x-org-id": "org-from-header" },
      });

      expect(getOrgIdFromRequest(request)).toBe("org-from-header");
    });

    it("should extract orgId from query param when no header", async () => {
      const { getOrgIdFromRequest } = await import("../middleware");

      const request = new Request("http://localhost/api/test?orgId=org-from-query");

      expect(getOrgIdFromRequest(request)).toBe("org-from-query");
    });

    it("should return null when no orgId found", async () => {
      const { getOrgIdFromRequest } = await import("../middleware");

      const request = new Request("http://localhost/api/test");

      expect(getOrgIdFromRequest(request)).toBeNull();
    });

    it("should prefer header over query param", async () => {
      const { getOrgIdFromRequest } = await import("../middleware");

      const request = new Request("http://localhost/api/test?orgId=org-from-query", {
        headers: { "x-org-id": "org-from-header" },
      });

      expect(getOrgIdFromRequest(request)).toBe("org-from-header");
    });
  });

  describe("expressRequireFeature (Express-style)", () => {
    it("should call next() when feature is enabled", async () => {
      const { expressRequireFeature } = await import("../middleware");

      mockService.hasFeature.mockResolvedValue(true);

      const middleware = expressRequireFeature("EXPORT_PDF");
      const req = { headers: { "x-org-id": "org-1" } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 403 when feature is disabled", async () => {
      const { expressRequireFeature } = await import("../middleware");

      mockService.hasFeature.mockResolvedValue(false);

      const middleware = expressRequireFeature("EXPORT_PDF");
      const req = { headers: { "x-org-id": "org-1" }, query: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "FEATURE_NOT_AVAILABLE" }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when orgId is missing", async () => {
      const { expressRequireFeature } = await import("../middleware");

      const middleware = expressRequireFeature("EXPORT_PDF");
      const req = { headers: {}, query: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Organization not found" }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 500 on service error", async () => {
      const { expressRequireFeature } = await import("../middleware");

      mockService.hasFeature.mockRejectedValue(new Error("Database error"));

      const middleware = expressRequireFeature("EXPORT_PDF");
      const req = { headers: { "x-org-id": "org-1" }, query: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("expressConsumeFeature (Express-style)", () => {
    it("should call next() when consumption succeeds", async () => {
      const { expressConsumeFeature } = await import("../middleware");

      mockService.consume.mockResolvedValue({
        success: true,
        used: 5,
        limit: 10,
        resetAt: new Date(),
      });

      const middleware = expressConsumeFeature("AI_GENERATIONS", 1);
      const req = { headers: { "x-org-id": "org-1" }, query: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() };
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 10);
      expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 5);
    });

    it("should return 402 when limit reached", async () => {
      const { expressConsumeFeature } = await import("../middleware");

      mockService.consume.mockResolvedValue({
        success: false,
        used: 10,
        limit: 10,
        resetAt: new Date(),
        error: "LIMIT_REACHED",
        feature: "AI_GENERATIONS",
      });

      const middleware = expressConsumeFeature("AI_GENERATIONS", 1);
      const req = { headers: { "x-org-id": "org-1" }, query: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() };
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "LIMIT_REACHED" }));
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when orgId is missing", async () => {
      const { expressConsumeFeature } = await import("../middleware");

      const middleware = expressConsumeFeature("AI_GENERATIONS", 1);
      const req = { headers: {}, query: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() };
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 500 on service error", async () => {
      const { expressConsumeFeature } = await import("../middleware");

      mockService.consume.mockRejectedValue(new Error("Database error"));

      const middleware = expressConsumeFeature("AI_GENERATIONS", 1);
      const req = { headers: { "x-org-id": "org-1" }, query: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() };
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
