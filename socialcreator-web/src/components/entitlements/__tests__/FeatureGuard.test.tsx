/**
 * Tests for FeatureGuard, FeatureButton, and FeatureLink components
 *
 * All three components use fetch to /api/entitlements to check feature availability.
 * FeatureGuard: conditional render with loading skeleton, children, fallback, upgrade banner.
 * FeatureButton: disabled state when feature not available.
 * FeatureLink: redirects to billing when feature not available.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { FeatureButton, FeatureGuard, FeatureLink } from "../FeatureGuard";

// ── Mocks ────────────────────────────────────────────────────────────────

const mockFetch = vi.hoisted(() => vi.fn());

vi.stubGlobal("fetch", mockFetch);

// Helper to resolve the entitlements fetch
function mockEntitlementsResponse(features: Record<string, boolean>) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ features }),
  });
}

function mockEntitlementsError() {
  mockFetch.mockRejectedValue(new Error("Network error"));
}

function mockEntitlementsNotOk() {
  mockFetch.mockResolvedValue({
    ok: false,
    json: async () => ({ features: {} }),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("FeatureGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton while fetching entitlements", () => {
    // Don't resolve the fetch yet
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { container } = render(
      <FeatureGuard feature="ai_writing">
        <div>Protected content</div>
      </FeatureGuard>,
    );

    // Should show the loading skeleton (animate-pulse div)
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders children when feature is enabled", async () => {
    mockEntitlementsResponse({ ai_writing: true });

    render(
      <FeatureGuard feature="ai_writing">
        <div>Protected content</div>
      </FeatureGuard>,
    );

    await waitFor(() => {
      expect(screen.getByText("Protected content")).toBeInTheDocument();
    });
  });

  it("renders nothing (fallback=null) when feature is disabled", async () => {
    mockEntitlementsResponse({ ai_writing: false });

    render(
      <FeatureGuard feature="ai_writing">
        <div>Protected content</div>
      </FeatureGuard>,
    );

    await waitFor(() => {
      expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    });
  });

  it("renders custom fallback when feature is disabled", async () => {
    mockEntitlementsResponse({ ai_writing: false });

    render(
      <FeatureGuard feature="ai_writing" fallback={<div>Upgrade required</div>}>
        <div>Protected content</div>
      </FeatureGuard>,
    );

    await waitFor(() => {
      expect(screen.getByText("Upgrade required")).toBeInTheDocument();
    });
  });

  it("shows upgrade banner with link when showUpgradeBanner is true", async () => {
    mockEntitlementsResponse({ ai_writing: false });

    render(
      <FeatureGuard feature="ai_writing" showUpgradeBanner={true}>
        <div>Protected content</div>
      </FeatureGuard>,
    );

    await waitFor(() => {
      expect(screen.getByText(/This feature requires a higher plan/)).toBeInTheDocument();
      const link = screen.getByText("Upgrade now");
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute("href", "/settings/billing?upgrade=true");
    });
  });

  it("renders both fallback and upgrade banner when showUpgradeBanner is true with fallback", async () => {
    mockEntitlementsResponse({ ai_writing: false });

    render(
      <FeatureGuard
        feature="ai_writing"
        showUpgradeBanner={true}
        fallback={<div>Custom fallback</div>}
      >
        <div>Protected content</div>
      </FeatureGuard>,
    );

    await waitFor(() => {
      expect(screen.getByText("Custom fallback")).toBeInTheDocument();
      expect(screen.getByText(/This feature requires a higher plan/)).toBeInTheDocument();
    });
  });

  it("handles fetch API error gracefully", async () => {
    mockEntitlementsError();

    render(
      <FeatureGuard feature="ai_writing">
        <div>Protected content</div>
      </FeatureGuard>,
    );

    await waitFor(() => {
      // On error, should treat feature as disabled
      expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    });
  });

  it("handles non-ok response gracefully", async () => {
    mockEntitlementsNotOk();

    render(
      <FeatureGuard feature="ai_writing">
        <div>Protected content</div>
      </FeatureGuard>,
    );

    await waitFor(() => {
      expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    });
  });
});

describe("FeatureButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a button when feature is enabled", async () => {
    mockEntitlementsResponse({ export_pdf: true });

    render(<FeatureButton feature="export_pdf">Export PDF</FeatureButton>);

    await waitFor(() => {
      const btn = screen.getByText("Export PDF");
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });
  });

  it("disables button when feature is not available", async () => {
    mockEntitlementsResponse({ export_pdf: false });

    render(<FeatureButton feature="export_pdf">Export PDF</FeatureButton>);

    await waitFor(() => {
      const btn = screen.getByText("Export PDF");
      expect(btn).toBeDisabled();
    });
  });

  it("applies disabled styling when feature is not available", async () => {
    mockEntitlementsResponse({ export_pdf: false });

    render(
      <FeatureButton feature="export_pdf" className="test-class">
        Export PDF
      </FeatureButton>,
    );

    await waitFor(() => {
      const btn = screen.getByText("Export PDF");
      expect(btn.className).toContain("opacity-50");
      expect(btn.className).toContain("cursor-not-allowed");
    });
  });

  it("shows title tooltip when feature is not available", async () => {
    mockEntitlementsResponse({ export_pdf: false });

    render(<FeatureButton feature="export_pdf">Export PDF</FeatureButton>);

    await waitFor(() => {
      const btn = screen.getByText("Export PDF");
      expect(btn).toHaveAttribute("title", 'Feature "export_pdf" not available on your plan');
    });
  });

  it("remains disabled even if disabled prop is true and feature is enabled", async () => {
    mockEntitlementsResponse({ export_pdf: true });

    render(
      <FeatureButton feature="export_pdf" disabled={true}>
        Export PDF
      </FeatureButton>,
    );

    await waitFor(() => {
      const btn = screen.getByText("Export PDF");
      expect(btn).toBeDisabled();
    });
  });

  it("calls onClick when clicked and feature is enabled", async () => {
    mockEntitlementsResponse({ export_pdf: true });
    const onClick = vi.fn();

    render(
      <FeatureButton feature="export_pdf" onClick={onClick}>
        Export PDF
      </FeatureButton>,
    );

    await waitFor(() => {
      expect(screen.getByText("Export PDF")).not.toBeDisabled();
    });

    screen.getByText("Export PDF").click();
    expect(onClick).toHaveBeenCalled();
  });
});

describe("FeatureLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a link to provided href when feature is enabled", async () => {
    mockEntitlementsResponse({ analytics: true });

    render(
      <FeatureLink feature="analytics" href="/analytics">
        View Analytics
      </FeatureLink>,
    );

    await waitFor(() => {
      const link = screen.getByText("View Analytics");
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute("href", "/analytics");
    });
  });

  it("renders a link to billing upgrade when feature is not available", async () => {
    mockEntitlementsResponse({ analytics: false });

    render(
      <FeatureLink feature="analytics" href="/analytics">
        View Analytics
      </FeatureLink>,
    );

    await waitFor(() => {
      const link = screen.getByText("View Analytics");
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute("href", "/settings/billing?upgrade=true");
    });
  });

  it("shows title tooltip when feature is not available", async () => {
    mockEntitlementsResponse({ analytics: false });

    render(
      <FeatureLink feature="analytics" href="/analytics">
        View Analytics
      </FeatureLink>,
    );

    await waitFor(() => {
      const link = screen.getByText("View Analytics");
      expect(link).toHaveAttribute("title", 'Feature "analytics" not available on your plan');
    });
  });

  it("applies className to link", async () => {
    mockEntitlementsResponse({ analytics: true });

    render(
      <FeatureLink feature="analytics" href="/analytics" className="custom-class">
        View Analytics
      </FeatureLink>,
    );

    await waitFor(() => {
      const link = screen.getByText("View Analytics");
      expect(link.className).toContain("custom-class");
    });
  });
});
