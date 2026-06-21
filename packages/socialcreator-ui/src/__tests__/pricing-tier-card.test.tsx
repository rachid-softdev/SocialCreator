import React from "react";
import { describe, expect, it } from "vitest";
import { PricingTierCard } from "../pricing-tier-card";
import { render } from "./test-utils";

describe("@socialcreator/ui - PricingTierCard", () => {
  it("should render children", () => {
    const { container, cleanup } = render(
      <PricingTierCard>
        <h3>Pro Plan</h3>
        <p>$29/mo</p>
      </PricingTierCard>,
    );
    expect(container.textContent).toContain("Pro Plan");
    expect(container.textContent).toContain("$29/mo");
    cleanup();
  });

  it("should render default (non-featured) styling", () => {
    const { container, cleanup } = render(<PricingTierCard>Standard</PricingTierCard>);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("border-hairline");
    expect(card.className).toContain("bg-surface-card");
    expect(card.className).toContain("text-ink");
    cleanup();
  });

  it("should render featured styling", () => {
    const { container, cleanup } = render(
      <PricingTierCard featured>Featured Plan</PricingTierCard>,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("border-transparent");
    expect(card.className).toContain("bg-surface-dark");
    expect(card.className).toContain("text-on-dark");
    cleanup();
  });

  it("should apply additional className", () => {
    const { container, cleanup } = render(
      <PricingTierCard className="custom-card">Custom</PricingTierCard>,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("custom-card");
    cleanup();
  });
});
