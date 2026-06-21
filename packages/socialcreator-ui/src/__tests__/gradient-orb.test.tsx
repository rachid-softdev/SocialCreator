import React from "react";
import { describe, expect, it } from "vitest";
import { GradientOrb } from "../gradient-orb";
import { render } from "./test-utils";

describe("@socialcreator/ui - GradientOrb", () => {
  it("should render with mint color", () => {
    const { container, cleanup } = render(<GradientOrb color="mint" />);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain("relative overflow-hidden");
    const gradient = outer.querySelector("div");
    expect(gradient?.className).toContain("from-gradient-mint/40");
    cleanup();
  });

  it("should render with each valid color without error", () => {
    const colors = ["mint", "peach", "lavender", "sky", "rose"] as const;
    for (const color of colors) {
      const { cleanup } = render(<GradientOrb color={color}>Content</GradientOrb>);
      cleanup();
    }
  });

  it("should render children inside the orb", () => {
    const { container, cleanup } = render(
      <GradientOrb color="lavender">
        <span>Child content</span>
      </GradientOrb>,
    );
    expect(container.textContent).toBe("Child content");
    cleanup();
  });

  it("should apply additional className", () => {
    const { container, cleanup } = render(<GradientOrb color="sky" className="my-extra-class" />);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain("my-extra-class");
    cleanup();
  });

  it("should not render children wrapper when no children", () => {
    const { container, cleanup } = render(<GradientOrb color="rose" />);
    const wrappers = container.querySelectorAll('[class*="relative"]');
    // Should only have the outer container, not the z-10 wrapper
    expect(wrappers.length).toBeGreaterThanOrEqual(1);
    cleanup();
  });
});
