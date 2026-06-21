import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FeatureGuard,
  LimitIndicator,
  UpgradeBanner,
  useCanConsume,
  useEntitlements,
  useFeature,
  useLimit,
} from "../../hooks/use-entitlements";
import { render } from "../test-utils";

/**
 * Renders a hook inside a test component and returns its latest value.
 * Uses a ref object so the returned `current` always reflects re-renders.
 */
function renderHook<T>(hook: () => T) {
  const resultRef: { current: T } = { current: undefined as unknown as T };

  function TestComponent() {
    resultRef.current = hook();
    return null;
  }

  const { cleanup } = render(React.createElement(TestComponent));

  return { result: resultRef, cleanup };
}

describe("@socialcreator/ui - useEntitlements", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: "pro",
        status: "active",
        features: { ai_writer: true, analytics: false },
        limits: { posts_per_day: 10, team_members: 3 },
        usage: { posts_per_day: 4, team_members: 1 },
        reset_at: { posts_per_day: "2025-07-01T00:00:00Z", team_members: null },
      }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should start in loading state", () => {
    const { result, cleanup } = renderHook(() => useEntitlements());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    cleanup();
  });

  it("should report loading when fetch resolves", async () => {
    const { result, cleanup } = renderHook(() => useEntitlements());
    // Wait for fetch (give React time to flush the state update)
    await vi.waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 2000 },
    );
    expect(result.current.data?.plan).toBe("pro");
    expect(fetch).toHaveBeenCalledWith("/api/entitlements", expect.any(Object));
    cleanup();
  });

  it("should handle fetch error", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const { result, cleanup } = renderHook(() => useEntitlements());
    await vi.waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 2000 },
    );
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe("Network error");
    cleanup();
  });

  it("should handle non-ok response", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const { result, cleanup } = renderHook(() => useEntitlements());
    await vi.waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 2000 },
    );
    expect(result.current.error?.message).toBe("Failed: 500");
    cleanup();
  });
});

describe("@socialcreator/ui - useFeature", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: "pro",
        status: "active",
        features: { ai_writer: true, analytics: false },
        limits: {},
        usage: {},
        reset_at: {},
      }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return enabled=true for enabled features", async () => {
    const { result, cleanup } = renderHook(() => useFeature("ai_writer"));
    await vi.waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 2000 },
    );
    expect(result.current.enabled).toBe(true);
    cleanup();
  });

  it("should return enabled=false for disabled features", async () => {
    const { result, cleanup } = renderHook(() => useFeature("analytics"));
    await vi.waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 2000 },
    );
    expect(result.current.enabled).toBe(false);
    cleanup();
  });

  it("should return enabled=false for unknown features", async () => {
    const { result, cleanup } = renderHook(() => useFeature("unknown"));
    await vi.waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 2000 },
    );
    expect(result.current.enabled).toBe(false);
    cleanup();
  });
});

describe("@socialcreator/ui - useLimit", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: "pro",
        status: "active",
        features: {},
        limits: { posts_per_day: 10, team_members: null },
        usage: { posts_per_day: 4, team_members: 0 },
        reset_at: { posts_per_day: "2025-07-01T00:00:00Z", team_members: null },
      }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return limit, used, and remaining", async () => {
    const { result, cleanup } = renderHook(() => useLimit("posts_per_day"));
    await vi.waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 2000 },
    );
    expect(result.current.limit).toBe(10);
    expect(result.current.used).toBe(4);
    expect(result.current.remaining).toBe(6);
    expect(result.current.resetAt).toBe("2025-07-01T00:00:00Z");
    cleanup();
  });

  it("should return remaining=null for unlimited limits", async () => {
    const { result, cleanup } = renderHook(() => useLimit("team_members"));
    await vi.waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 2000 },
    );
    expect(result.current.limit).toBeNull();
    expect(result.current.used).toBe(0);
    expect(result.current.remaining).toBeNull();
    cleanup();
  });
});

describe("@socialcreator/ui - useCanConsume", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: "pro",
        status: "active",
        features: {},
        limits: { posts_per_day: 10 },
        usage: { posts_per_day: 9 },
        reset_at: {},
      }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return true when under limit", async () => {
    const { result, cleanup } = renderHook(() => useCanConsume("posts_per_day", 1));
    await vi.waitFor(
      () => {
        expect(result.current).toBe(true);
      },
      { timeout: 2000 },
    );
    cleanup();
  });

  it("should return false when over limit", async () => {
    const { result, cleanup } = renderHook(() => useCanConsume("posts_per_day", 2));
    await vi.waitFor(
      () => {
        expect(result.current).toBe(false);
      },
      { timeout: 2000 },
    );
    cleanup();
  });
});

describe("@socialcreator/ui - FeatureGuard", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: "pro",
        status: "active",
        features: { ai_writer: true, premium: false },
        limits: {},
        usage: {},
        reset_at: {},
      }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render children when feature is enabled", async () => {
    const { container, cleanup } = render(
      <FeatureGuard feature="ai_writer">
        <span>Premium Content</span>
      </FeatureGuard>,
    );
    await vi.waitFor(
      () => {
        expect(container.textContent).toBe("Premium Content");
      },
      { timeout: 2000 },
    );
    cleanup();
  });

  it("should render fallback when feature is disabled", async () => {
    const { container, cleanup } = render(
      <FeatureGuard feature="premium" fallback={<span>Upgrade Required</span>}>
        <span>Premium Content</span>
      </FeatureGuard>,
    );
    await vi.waitFor(
      () => {
        expect(container.textContent).toBe("Upgrade Required");
      },
      { timeout: 2000 },
    );
    cleanup();
  });

  it("should render nothing while loading (default fallback is null)", () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    const { container, cleanup } = render(
      <FeatureGuard feature="ai_writer">
        <span>Content</span>
      </FeatureGuard>,
    );
    expect(container.textContent).toBe("");
    cleanup();
  });
});

describe("@socialcreator/ui - LimitIndicator", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: "pro",
        status: "active",
        features: {},
        limits: { posts_per_day: 10, team_members: null },
        usage: { posts_per_day: 4, team_members: 0 },
        reset_at: { posts_per_day: "2025-07-01T00:00:00Z", team_members: null },
      }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render usage information", async () => {
    const { container, cleanup } = render(<LimitIndicator feature="posts_per_day" />);
    await vi.waitFor(
      () => {
        expect(container.textContent).toContain("4");
      },
      { timeout: 2000 },
    );
    expect(container.textContent).toContain("10");
    expect(container.textContent).toContain("6");
    cleanup();
  });

  it("should render 'Unlimited' for null limits", async () => {
    const { container, cleanup } = render(<LimitIndicator feature="team_members" />);
    await vi.waitFor(
      () => {
        expect(container.textContent).toContain("Unlimited");
      },
      { timeout: 2000 },
    );
    cleanup();
  });

  it("should show loading state", () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    const { container, cleanup } = render(<LimitIndicator feature="posts_per_day" />);
    expect(container.textContent).toContain("Loading...");
    cleanup();
  });
});

describe("@socialcreator/ui - UpgradeBanner", () => {
  it("should render default message", () => {
    const { container, cleanup } = render(<UpgradeBanner />);
    expect(container.textContent).toContain("Upgrade your plan to access this feature");
    expect(container.textContent).toContain("Upgrade");
    cleanup();
  });

  it("should render custom message", () => {
    const { container, cleanup } = render(<UpgradeBanner message="Custom upgrade message" />);
    expect(container.textContent).toContain("Custom upgrade message");
    cleanup();
  });

  it("should render feature name when provided", () => {
    const { container, cleanup } = render(<UpgradeBanner feature="ai_writer" />);
    expect(container.textContent).toContain("Feature: ai_writer");
    cleanup();
  });

  it("should have upgrade link pointing to billing", () => {
    const { container, cleanup } = render(<UpgradeBanner />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/settings/billing?upgrade=true");
    expect(link?.textContent).toBe("Upgrade");
    cleanup();
  });
});
