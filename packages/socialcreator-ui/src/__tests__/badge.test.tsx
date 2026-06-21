import React from "react";
import { describe, expect, it } from "vitest";
import { Badge } from "../badge";
import { BadgePill } from "../badge-pill";
import { render } from "./test-utils";

describe("@socialcreator/ui - Badge", () => {
  it("should render with default variant", () => {
    const { container, cleanup } = render(<Badge>Default</Badge>);
    const span = container.querySelector("span");
    expect(span).toBeTruthy();
    expect(span?.textContent).toBe("Default");
    expect(span?.className).toContain("bg-primary/10");
    expect(span?.className).toContain("text-primary");
    cleanup();
  });

  it("should render with secondary variant", () => {
    const { container, cleanup } = render(<Badge variant="secondary">Secondary</Badge>);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-secondary/10");
    cleanup();
  });

  it("should render with outline variant", () => {
    const { container, cleanup } = render(<Badge variant="outline">Outline</Badge>);
    const span = container.querySelector("span");
    expect(span?.className).toContain("border");
    cleanup();
  });

  it("should render with destructive variant", () => {
    const { container, cleanup } = render(<Badge variant="destructive">Error</Badge>);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-semantic-error/10");
    cleanup();
  });

  it("should render with success variant", () => {
    const { container, cleanup } = render(<Badge variant="success">Success</Badge>);
    const span = container.querySelector("span");
    expect(span?.className).toContain("bg-semantic-success/10");
    cleanup();
  });

  it("should apply additional className", () => {
    const { container, cleanup } = render(<Badge className="extra-class">Styled</Badge>);
    const span = container.querySelector("span");
    expect(span?.className).toContain("extra-class");
    cleanup();
  });
});

describe("@socialcreator/ui - BadgePill", () => {
  it("should render children", () => {
    const { container, cleanup } = render(<BadgePill>Pro</BadgePill>);
    expect(container.textContent).toBe("Pro");
    cleanup();
  });

  it("should apply base classes", () => {
    const { container, cleanup } = render(<BadgePill>Feature</BadgePill>);
    const span = container.querySelector("span");
    expect(span?.className).toContain("rounded-pill");
    expect(span?.className).toContain("bg-surface-strong");
    cleanup();
  });

  it("should apply additional className", () => {
    const { container, cleanup } = render(<BadgePill className="my-class">Tag</BadgePill>);
    const span = container.querySelector("span");
    expect(span?.className).toContain("my-class");
    cleanup();
  });
});
