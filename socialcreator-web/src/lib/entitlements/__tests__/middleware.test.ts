/**
 * Feature Flags & Entitlements - Middleware Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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

      const result = await middleware(context, handler);

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
});
