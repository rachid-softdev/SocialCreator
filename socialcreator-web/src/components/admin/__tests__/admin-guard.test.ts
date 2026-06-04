/**
 * Tests for AdminGuard component
 *
 * Strategy: AdminGuard is a "use client" React component with stateful
 * hooks (useState, useEffect) and runtime redirects. Since the vitest
 * environment is "node" (no jsdom), we mock React hooks to control the
 * component's state transitions and verify behaviours at each stage.
 *
 * 1. Loading state  — spinner rendered, no redirect
 * 2. Unauthenticated  — initial render returns null; after state
 *    transition, redirect is called
 * 3. Authenticated non-ADMIN  — same redirect flow, supports custom fallback
 * 4. Authenticated ADMIN  — children rendered, no redirect
 */

// ── All vi.mock factories MUST use only hoisted references ───────────────

const hooks = vi.hoisted(() => {
  const mockSetState = vi.fn();
  const mockUseState = vi.fn();
  const mockUseEffect = vi.fn();
  return { mockSetState, mockUseState, mockUseEffect };
});

const mockUseSession = vi.hoisted(() => vi.fn());

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: hooks.mockUseState,
    useEffect: hooks.mockUseEffect,
  };
});

vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
}));

const mockRedirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    mockRedirect(path);
    // Simulate Next.js redirect — throws to interrupt rendering
    const err = new Error("NEXT_REDIRECT");
    (err as Error & { digest: string }).digest = "NEXT_REDIRECT";
    throw err;
  },
}));

vi.mock("lucide-react", () => ({
  Loader2: "Loader2",
}));

// ── Imports (after all vi.mock) ──────────────────────────────────────────

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminGuard } from "../admin-guard";

// ── Test helpers ──────────────────────────────────────────────────────────

interface SessionShape {
  data: { user: { role: string } } | null;
  status: "loading" | "authenticated" | "unauthenticated";
}

function setSession(session: SessionShape): void {
  mockUseSession.mockReturnValue(session);
}

/** Configure the mocked useState to return [shouldRedirect, setState] */
function setShouldRedirect(value: boolean): void {
  hooks.mockUseState.mockReturnValue([value, hooks.mockSetState]);
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("AdminGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: useEffect does NOT auto-fire (tests control it)
    hooks.mockUseEffect.mockImplementation(() => {});
  });

  // ── Loading state ─────────────────────────────────────────────────────

  describe("loading state", () => {
    beforeEach(() => {
      setSession({ data: null, status: "loading" });
      setShouldRedirect(false);
    });

    it("renders a spinner container when session status is loading", () => {
      const result = AdminGuard({ children: "content" }) as React.ReactElement;

      expect(result).not.toBeNull();
      expect(typeof result).toBe("object");
      expect((result as React.ReactElement).type).toBe("div");
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  // ── Unauthenticated ──────────────────────────────────────────────────

  describe("unauthenticated", () => {
    beforeEach(() => {
      setSession({ data: null, status: "unauthenticated" });
    });

    it("returns null on initial render (before useEffect fires)", () => {
      setShouldRedirect(false);

      const result = AdminGuard({ children: "content" });

      expect(result).toBeNull();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("redirects to /dashboard when shouldRedirect becomes true", () => {
      setShouldRedirect(true);

      expect(() => AdminGuard({ children: "content" })).toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });
  });

  // ── Authenticated non-ADMIN ──────────────────────────────────────────

  describe("authenticated non-ADMIN user", () => {
    beforeEach(() => {
      setSession({
        data: { user: { role: "USER" } },
        status: "authenticated",
      });
    });

    it("returns null on initial render (before useEffect fires)", () => {
      setShouldRedirect(false);

      const result = AdminGuard({ children: "content" });

      expect(result).toBeNull();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("redirects to /dashboard by default", () => {
      setShouldRedirect(true);

      expect(() => AdminGuard({ children: "content" })).toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });

    it("redirects to custom fallback path", () => {
      setShouldRedirect(true);

      expect(() => AdminGuard({ children: "content", fallback: "/admin/denied" })).toThrow(
        "NEXT_REDIRECT",
      );
      expect(mockRedirect).toHaveBeenCalledWith("/admin/denied");
    });

    it("does NOT call setShouldRedirect when role is checked before effect", () => {
      // Initial render — inline check returns null without calling
      // setShouldRedirect (that belongs to the effect).
      setShouldRedirect(false);

      AdminGuard({ children: "content" });

      expect(hooks.mockSetState).not.toHaveBeenCalled();
    });
  });

  // ── Authenticated ADMIN ──────────────────────────────────────────────

  describe("authenticated ADMIN user", () => {
    beforeEach(() => {
      setSession({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });
      setShouldRedirect(false);
    });

    it("renders children when user is ADMIN", () => {
      const result = AdminGuard({ children: "admin content" });

      expect(result).not.toBeNull();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("renders JSX children when user is ADMIN", () => {
      const jsxChild = React.createElement("span", null, "admin panel");
      const result = AdminGuard({ children: jsxChild });

      expect(result).not.toBeNull();
    });

    it("does not redirect when user is ADMIN", () => {
      AdminGuard({ children: "content" });

      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("does NOT call setShouldRedirect for ADMIN role", () => {
      hooks.mockUseEffect.mockImplementation((cb: () => void) => cb());

      AdminGuard({ children: "content" });

      expect(hooks.mockSetState).not.toHaveBeenCalled();
    });
  });

  // ── useEffect behaviour ──────────────────────────────────────────────

  describe("useEffect redirect logic", () => {
    it("triggers setShouldRedirect(true) when unauthenticated", () => {
      setSession({ data: null, status: "unauthenticated" });
      setShouldRedirect(false);

      hooks.mockUseEffect.mockImplementation((cb: () => void) => cb());

      AdminGuard({ children: "content" });

      expect(hooks.mockSetState).toHaveBeenCalledWith(true);
    });

    it("triggers setShouldRedirect(true) when authenticated non-ADMIN", () => {
      setSession({
        data: { user: { role: "EDITOR" } },
        status: "authenticated",
      });
      setShouldRedirect(false);

      hooks.mockUseEffect.mockImplementation((cb: () => void) => cb());

      AdminGuard({ children: "content" });

      expect(hooks.mockSetState).toHaveBeenCalledWith(true);
    });

    it("does NOT trigger setShouldRedirect for ADMIN role", () => {
      setSession({
        data: { user: { role: "ADMIN" } },
        status: "authenticated",
      });
      setShouldRedirect(false);

      hooks.mockUseEffect.mockImplementation((cb: () => void) => cb());

      AdminGuard({ children: "content" });

      expect(hooks.mockSetState).not.toHaveBeenCalled();
    });
  });
});
