import React from "react";
import { describe, expect, it } from "vitest";
import { Button } from "../button";
import { render } from "./test-utils";

describe("@socialcreator/ui - Button", () => {
  it("should render with default variant and size", () => {
    const { container, cleanup } = render(<Button>Click me</Button>);
    const btn = container.querySelector("button");
    expect(btn).toBeTruthy();
    expect(btn?.textContent).toBe("Click me");
    expect(btn?.className).toContain("bg-primary");
    expect(btn?.className).toContain("px-4 py-2");
    cleanup();
  });

  it("should render with outline variant", () => {
    const { container, cleanup } = render(<Button variant="outline">Outline</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("border");
    expect(btn?.className).toContain("hover:bg-surface-strong");
    cleanup();
  });

  it("should render with ghost variant", () => {
    const { container, cleanup } = render(<Button variant="ghost">Ghost</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("hover:text-ink");
    expect(btn?.className).toContain("hover:bg-surface-strong");
    cleanup();
  });

  it("should render with destructive variant", () => {
    const { container, cleanup } = render(<Button variant="destructive">Delete</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("bg-semantic-error");
    // text-white is not expected because twMerge strips it (text-button wins)
    // Check for the destructive-specific classes instead
    expect(btn?.className).toContain("hover:bg-semantic-error/90");
    cleanup();
  });

  it("should render with sm size", () => {
    const { container, cleanup } = render(<Button size="sm">Small</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("px-3 py-1.5");
    cleanup();
  });

  it("should render with lg size", () => {
    const { container, cleanup } = render(<Button size="lg">Large</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("px-6 py-3");
    cleanup();
  });

  it("should render as button element by default", () => {
    const { container, cleanup } = render(<Button>Text</Button>);
    const btn = container.querySelector("button");
    expect(btn).toBeTruthy();
    expect(btn?.textContent).toBe("Text");
    cleanup();
  });

  it("should forward ref", () => {
    let ref: HTMLButtonElement | null = null;
    const { container, cleanup } = render(
      <Button
        ref={(el) => {
          ref = el;
        }}
      >
        Ref test
      </Button>,
    );
    expect(ref).toBeInstanceOf(HTMLButtonElement);
    expect(ref!.textContent).toBe("Ref test");
    cleanup();
  });

  it("should apply disabled attribute", () => {
    const { container, cleanup } = render(<Button disabled>Disabled</Button>);
    const btn = container.querySelector("button");
    expect(btn?.disabled).toBe(true);
    expect(btn?.className).toContain("disabled:opacity-50");
    cleanup();
  });
});
