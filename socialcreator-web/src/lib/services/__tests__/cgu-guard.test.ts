/**
 * Tests for CGU guard service (cgu-guard.ts)
 *
 * Covers requireCguAccepted, withCguGuard, checkCguForPage,
 * and requiresCgu utility.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuth = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CGU guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireCguAccepted", () => {
    it("should be a function", async () => {
      const { requireCguAccepted } = await import("@/lib/services/cgu-guard");
      expect(typeof requireCguAccepted).toBe("function");
    });

    it("should return userId and cguAccepted when CGU is accepted", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        cguAccepted: true,
        cguAcceptedAt: new Date("2024-01-01"),
      } as any);

      const { requireCguAccepted } = await import("@/lib/services/cgu-guard");
      const result = await requireCguAccepted(new Request("http://localhost/api/test"));

      expect(result).toEqual({ userId: "user-1", cguAccepted: true });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { cguAccepted: true, cguAcceptedAt: true },
      });
    });

    it("should throw 401 when there is no session", async () => {
      mockAuth.mockResolvedValue(null);

      const { requireCguAccepted } = await import("@/lib/services/cgu-guard");
      await expect(
        requireCguAccepted(new Request("http://localhost/api/test")),
      ).rejects.toMatchObject({
        status: 401,
        message: "Authentication required",
      });
    });

    it("should throw 401 when session has no user id", async () => {
      mockAuth.mockResolvedValue({ user: {} });

      const { requireCguAccepted } = await import("@/lib/services/cgu-guard");
      await expect(
        requireCguAccepted(new Request("http://localhost/api/test")),
      ).rejects.toMatchObject({
        status: 401,
        message: "Authentication required",
      });
    });

    it("should throw 403 with redirect when CGU is not accepted", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        cguAccepted: false,
        cguAcceptedAt: null,
      } as any);

      const { requireCguAccepted } = await import("@/lib/services/cgu-guard");
      await expect(
        requireCguAccepted(new Request("http://localhost/api/test")),
      ).rejects.toMatchObject({
        status: 403,
        message: "CGU acceptance required",
        redirectUrl: "/onboarding/cgu",
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", pathname: "/api/test" }),
        "CGU not accepted",
      );
    });

    it("should default to false when user record is not found", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const { requireCguAccepted } = await import("@/lib/services/cgu-guard");
      await expect(
        requireCguAccepted(new Request("http://localhost/api/test")),
      ).rejects.toMatchObject({
        status: 403,
        message: "CGU acceptance required",
      });
    });

    it("should pass along custom options", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        cguAccepted: true,
        cguAcceptedAt: new Date(),
      } as any);

      const { requireCguAccepted } = await import("@/lib/services/cgu-guard");
      const result = await requireCguAccepted(new Request("http://localhost/api/agents"), {
        requireCguForPublishing: false,
        requireCguForAgents: true,
        requireCguForAccounts: false,
      });

      expect(result).toEqual({ userId: "user-1", cguAccepted: true });
    });
  });

  describe("withCguGuard", () => {
    it("should be a function", async () => {
      const { withCguGuard } = await import("@/lib/services/cgu-guard");
      expect(typeof withCguGuard).toBe("function");
    });

    it("should call handler with userId when CGU is accepted", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        cguAccepted: true,
        cguAcceptedAt: new Date(),
      } as any);

      const handler = vi.fn().mockResolvedValue("handler result");

      const { withCguGuard } = await import("@/lib/services/cgu-guard");
      const result = await withCguGuard(new Request("http://localhost/api/test"), handler);

      expect(handler).toHaveBeenCalledWith("user-1");
      expect(result).toBe("handler result");
    });

    it("should throw when CGU is not accepted", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        cguAccepted: false,
        cguAcceptedAt: null,
      } as any);

      const handler = vi.fn();

      const { withCguGuard } = await import("@/lib/services/cgu-guard");
      await expect(
        withCguGuard(new Request("http://localhost/api/test"), handler),
      ).rejects.toMatchObject({
        status: 403,
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("checkCguForPage", () => {
    it("should be a function", async () => {
      const { checkCguForPage } = await import("@/lib/services/cgu-guard");
      expect(typeof checkCguForPage).toBe("function");
    });

    it("should return userId when CGU is accepted", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        cguAccepted: true,
      } as any);

      const { checkCguForPage } = await import("@/lib/services/cgu-guard");
      const result = await checkCguForPage();

      expect(result).toEqual({ userId: "user-1" });
      expect(result.redirect).toBeUndefined();
    });

    it("should return redirect to login when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const { checkCguForPage } = await import("@/lib/services/cgu-guard");
      const result = await checkCguForPage();

      expect(result).toEqual({ redirect: "/login" });
    });

    it("should return redirect to CGU when CGU not accepted", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        cguAccepted: false,
      } as any);

      const { checkCguForPage } = await import("@/lib/services/cgu-guard");
      const result = await checkCguForPage();

      expect(result).toEqual({ redirect: "/onboarding/cgu" });
    });

    it("should return redirect to CGU when user record not found", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const { checkCguForPage } = await import("@/lib/services/cgu-guard");
      const result = await checkCguForPage();

      expect(result).toEqual({ redirect: "/onboarding/cgu" });
    });
  });

  describe("requiresCgu", () => {
    it("should be a function", async () => {
      const { requiresCgu } = await import("@/lib/services/cgu-guard");
      expect(typeof requiresCgu).toBe("function");
    });

    it("should return true for exact CGU-required route", async () => {
      const { requiresCgu, CGU_REQUIRED_ROUTES } = await import("@/lib/services/cgu-guard");
      for (const route of CGU_REQUIRED_ROUTES) {
        expect(requiresCgu(route)).toBe(true);
      }
    });

    it("should return true for sub-paths of CGU-required routes", async () => {
      const mod = await import("@/lib/services/cgu-guard");
      const { requiresCgu } = mod;
      expect(requiresCgu("/dashboard/settings")).toBe(true);
      expect(requiresCgu("/api/agents/123")).toBe(true);
      expect(requiresCgu("/profiles/my-profile")).toBe(true);
    });

    it("should return false for non-CGU-required routes", async () => {
      const { requiresCgu } = await import("@/lib/services/cgu-guard");
      expect(requiresCgu("/login")).toBe(false);
      expect(requiresCgu("/onboarding/cgu")).toBe(false);
      expect(requiresCgu("/api/public")).toBe(false);
    });

    it("should return false for empty pathname", async () => {
      const { requiresCgu } = await import("@/lib/services/cgu-guard");
      expect(requiresCgu("")).toBe(false);
    });
  });
});
