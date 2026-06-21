import React from "react";
import { describe, expect, it } from "vitest";
import { NavTop } from "../nav-top";
import { render } from "./test-utils";

describe("@socialcreator/ui - NavTop", () => {
  it("should render with default props (empty links, no CTA)", () => {
    const { container, cleanup } = render(<NavTop />);
    // Should render brand name
    expect(container.textContent).toContain("SocialCreator");
    // Nav element should exist
    const nav = container.querySelector("nav");
    expect(nav).toBeTruthy();
    cleanup();
  });

  it("should render navigation links", () => {
    const links = [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
    ];
    const { container, cleanup } = render(<NavTop links={links} />);
    expect(container.textContent).toContain("Features");
    expect(container.textContent).toContain("Pricing");
    cleanup();
  });

  it("should render CTA button when provided", () => {
    const { container, cleanup } = render(
      <NavTop cta={{ href: "/signup", label: "Get Started" }} />,
    );
    expect(container.textContent).toContain("Get Started");
    const ctaLink = container.querySelector('a[href="/signup"]');
    expect(ctaLink).toBeTruthy();
    cleanup();
  });

  it("should not render links div when links array is empty", () => {
    const { container, cleanup } = render(<NavTop links={[]} />);
    // When empty, the links section should not be rendered
    const linkSections = container.querySelectorAll(".hidden.items-center");
    expect(linkSections.length).toBe(0);
    cleanup();
  });
});
