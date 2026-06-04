/**
 * Tests for PlatformIcon component
 *
 * Verifies:
 * - Renders correct icon for each platform
 * - Correct size variants
 * - Applies platform brand colors
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@/components/__tests__/test-utils";
import { PlatformIcon } from "../platform-icon";

// ── Module-level mocks ───────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(" "),
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("PlatformIcon", () => {
  const platforms = [
    "INSTAGRAM",
    "TIKTOK",
    "LINKEDIN",
    "X",
    "YOUTUBE",
    "FACEBOOK",
    "PINTEREST",
    "THREADS",
  ] as const;

  it("renders an icon for each platform", () => {
    for (const platform of platforms) {
      const { container } = render(<PlatformIcon platform={platform} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      // Clean up
      container.remove();
    }
  });

  it("applies the correct size class for sm size", () => {
    const { container } = render(<PlatformIcon platform="X" size="sm" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("w-6");
    expect(wrapper.className).toContain("h-6");
  });

  it("applies the correct size class for md size", () => {
    const { container } = render(<PlatformIcon platform="X" size="md" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("w-8");
    expect(wrapper.className).toContain("h-8");
  });

  it("applies the correct size class for lg size", () => {
    const { container } = render(<PlatformIcon platform="X" size="lg" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("w-10");
    expect(wrapper.className).toContain("h-10");
  });

  it("defaults to md size when no size is specified", () => {
    const { container } = render(<PlatformIcon platform="X" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("w-8");
    expect(wrapper.className).toContain("h-8");
  });

  it("applies platform-specific brand color class", () => {
    const { container } = render(<PlatformIcon platform="LINKEDIN" />);
    const wrapper = container.firstChild as HTMLElement;
    // LinkedIn uses bg-[#0A66C2]
    expect(wrapper.className).toContain("bg-[#0A66C2]");
  });

  it("applies custom className", () => {
    const { container } = render(<PlatformIcon platform="X" className="my-custom-class" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("my-custom-class");
  });

  it("renders an svg with aria-hidden='true'", () => {
    const { container } = render(<PlatformIcon platform="INSTAGRAM" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
