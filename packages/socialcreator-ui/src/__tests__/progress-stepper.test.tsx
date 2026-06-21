import React from "react";
import { describe, expect, it } from "vitest";
import { ProgressStepper } from "../progress-stepper";
import { render } from "./test-utils";

const defaultSteps = [
  { id: "1", label: "Create", icon: "1" },
  { id: "2", label: "Configure", icon: "2" },
  { id: "3", label: "Launch", icon: "3" },
];

describe("@socialcreator/ui - ProgressStepper", () => {
  it("should render all step labels", () => {
    const { container, cleanup } = render(<ProgressStepper steps={defaultSteps} currentStep={0} />);
    expect(container.textContent).toContain("Create");
    expect(container.textContent).toContain("Configure");
    expect(container.textContent).toContain("Launch");
    cleanup();
  });

  it("should highlight the active step label", () => {
    const { container, cleanup } = render(<ProgressStepper steps={defaultSteps} currentStep={1} />);
    // The active step (index 1, "Configure") should have a highlighted class
    const spans = container.querySelectorAll("span");
    const configureLabel = Array.from(spans).find((s) => s.textContent === "Configure");
    expect(configureLabel).toBeTruthy();
    expect(configureLabel?.className).toContain("text-body-strong");
    cleanup();
  });

  it("should render checkmark SVG for completed steps", () => {
    const { container, cleanup } = render(<ProgressStepper steps={defaultSteps} currentStep={2} />);
    // Steps 0 and 1 should be completed — each shows an SVG checkmark
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(2);
    cleanup();
  });

  it("should show step icons for non-completed steps", () => {
    const { container, cleanup } = render(<ProgressStepper steps={defaultSteps} currentStep={0} />);
    // All steps should render their icon text since none are completed yet
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("3");
    cleanup();
  });

  it("should render connecting lines between steps", () => {
    const { container, cleanup } = render(<ProgressStepper steps={defaultSteps} currentStep={0} />);
    // With 3 steps, there should be 2 connecting lines
    const allDivs = container.querySelectorAll("div");
    // Lines have class containing "mx-2" (margin for spacing)
    const lineDivs = Array.from(allDivs).filter((d) => d.className.includes("mx-2"));
    expect(lineDivs.length).toBe(2);
    cleanup();
  });

  it("should apply custom className", () => {
    const { container, cleanup } = render(
      <ProgressStepper steps={defaultSteps} currentStep={0} className="custom-stepper" />,
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain("custom-stepper");
    cleanup();
  });
});
