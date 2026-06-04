/**
 * Tests for PlatformBadge component.
 *
 * Renders platform icon and label from PLATFORMS data.
 * Handles unknown platforms and size variants.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { PlatformBadge } from "../platform-badge";

const mockPlatforms = vi.hoisted(() => [
  { value: "X", label: "X (Twitter)", icon: "𝕏" },
  { value: "LINKEDIN", label: "LinkedIn", icon: "💼" },
  { value: "INSTAGRAM", label: "Instagram", icon: "📷" },
  { value: "UNKNOWN_PLATFORM", label: "Unknown Platform", icon: "❓" },
]);

vi.mock("@socialcreator/types/profile", () => ({
  PLATFORMS: mockPlatforms,
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

describe("PlatformBadge", () => {
  it("renders platform icon and label for a known platform", () => {
    render(<PlatformBadge platform="X" />);
    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
    expect(screen.getByText("𝕏")).toBeInTheDocument();
  });

  it("renders another known platform with correct label", () => {
    render(<PlatformBadge platform="LINKEDIN" />);
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("💼")).toBeInTheDocument();
  });

  it("falls back to platform value string when platform is unknown", () => {
    render(<PlatformBadge platform="MYSTERY_APP" />);
    // When platform is not in PLATFORMS, the label falls back to the platform value
    expect(screen.getByText("MYSTERY_APP")).toBeInTheDocument();
  });

  it("applies sm size classes", () => {
    const { container } = render(<PlatformBadge platform="X" size="sm" />);
    // sm size uses smaller padding/text
    const span = container.firstChild as HTMLElement;
    expect(span).toBeInTheDocument();
  });

  it("applies md (default) size classes", () => {
    const { container } = render(<PlatformBadge platform="X" />);
    // md is the default
    const span = container.firstChild as HTMLElement;
    expect(span).toBeInTheDocument();
  });

  it("accepts a custom className", () => {
    render(<PlatformBadge platform="X" className="extra-class" />);
    // Should still render the label
    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
  });

  it("renders platform with icon using emoji when available", () => {
    render(<PlatformBadge platform="INSTAGRAM" />);
    expect(screen.getByText("📷")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
  });
});
