import React from "react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "../empty-state";
import { render } from "./test-utils";

describe("@socialcreator/ui - EmptyState", () => {
  it("should render title and description", () => {
    const { container, cleanup } = render(
      <EmptyState title="No items found" description="Try adjusting your filters." />,
    );
    expect(container.textContent).toContain("No items found");
    expect(container.textContent).toContain("Try adjusting your filters.");
    cleanup();
  });

  it("should render action element when provided", () => {
    const { container, cleanup } = render(
      <EmptyState
        title="No data"
        description="Add some data to get started."
        action={<button type="button">Add Data</button>}
      />,
    );
    const actionBtn = container.querySelector("button");
    expect(actionBtn).toBeTruthy();
    expect(actionBtn?.textContent).toBe("Add Data");
    cleanup();
  });

  it("should not render icon container when no icon is provided", () => {
    const { container, cleanup } = render(<EmptyState title="Empty" description="Nothing here." />);
    // The icon div is only rendered when icon prop is provided
    const iconContainers = container.querySelectorAll(".w-16\\.h-16");
    expect(iconContainers.length).toBe(0);
    cleanup();
  });

  it("should apply additional className", () => {
    const { container, cleanup } = render(
      <EmptyState title="Test" description="Test description" className="my-custom-class" />,
    );
    const div = container.querySelector("[data-testroot] > div") as HTMLElement;
    expect(div.className).toContain("my-custom-class");
    cleanup();
  });
});
