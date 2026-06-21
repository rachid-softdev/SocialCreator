import React from "react";
import { describe, expect, it } from "vitest";
import { FeatureCard } from "../feature-card";
import { render } from "./test-utils";

describe("@socialcreator/ui - FeatureCard", () => {
  it("should render children", () => {
    const { container, cleanup } = render(
      <FeatureCard>
        <h3>Feature Title</h3>
        <p>Description text</p>
      </FeatureCard>,
    );
    expect(container.textContent).toContain("Feature Title");
    expect(container.textContent).toContain("Description text");
    cleanup();
  });

  it("should have card styling classes", () => {
    const { container, cleanup } = render(<FeatureCard>Content</FeatureCard>);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("rounded-xl");
    expect(card.className).toContain("border");
    expect(card.className).toContain("bg-surface-card");
    expect(card.className).toContain("hover:shadow-card-hover");
    cleanup();
  });

  it("should apply additional className", () => {
    const { container, cleanup } = render(
      <FeatureCard className="custom-class">Styled</FeatureCard>,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("custom-class");
    cleanup();
  });
});
