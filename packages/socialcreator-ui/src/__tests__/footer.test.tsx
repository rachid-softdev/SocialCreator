import React from "react";
import { describe, expect, it } from "vitest";
import { Footer } from "../footer";
import { render } from "./test-utils";

describe("@socialcreator/ui - Footer", () => {
  it("should render with default (empty) columns", () => {
    const { container, cleanup } = render(<Footer />);
    // Should still render the footer element with copyright
    const footer = container.querySelector("footer");
    expect(footer).toBeTruthy();
    expect(container.textContent).toContain("SocialCreator. All rights reserved.");
    cleanup();
  });

  it("should render column titles and links", () => {
    const columns = [
      {
        title: "Product",
        links: [
          { href: "/features", label: "Features" },
          { href: "/pricing", label: "Pricing" },
        ],
      },
      {
        title: "Company",
        links: [
          { href: "/about", label: "About" },
          { href: "/blog", label: "Blog" },
        ],
      },
    ];
    const { container, cleanup } = render(<Footer columns={columns} />);
    expect(container.textContent).toContain("Product");
    expect(container.textContent).toContain("Features");
    expect(container.textContent).toContain("Pricing");
    expect(container.textContent).toContain("Company");
    expect(container.textContent).toContain("About");
    expect(container.textContent).toContain("Blog");
    cleanup();
  });

  it("should render copyright with current year", () => {
    const { container, cleanup } = render(<Footer />);
    const year = new Date().getFullYear().toString();
    expect(container.textContent).toContain(year);
    cleanup();
  });

  it("should render links with correct href", () => {
    const columns = [
      {
        title: "Links",
        links: [{ href: "/test", label: "Test Link" }],
      },
    ];
    const { container, cleanup } = render(<Footer columns={columns} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/test");
    expect(link?.textContent).toBe("Test Link");
    cleanup();
  });
});
