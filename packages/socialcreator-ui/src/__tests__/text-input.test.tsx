import React from "react";
import { describe, expect, it } from "vitest";
import { TextInput } from "../text-input";
import { render } from "./test-utils";

describe("@socialcreator/ui - TextInput", () => {
  it("should render an input element", () => {
    const { container, cleanup } = render(<TextInput placeholder="Enter text" />);
    const input = container.querySelector("input");
    expect(input).toBeTruthy();
    expect(input?.getAttribute("placeholder")).toBe("Enter text");
    cleanup();
  });

  it("should apply error styling when error prop is true", () => {
    const { container, cleanup } = render(<TextInput error />);
    const input = container.querySelector("input");
    expect(input?.className).toContain("border-semantic-error");
    cleanup();
  });

  it("should not have error styling when error is false", () => {
    const { container, cleanup } = render(<TextInput />);
    const input = container.querySelector("input");
    expect(input?.className).toContain("border-hairline-strong");
    expect(input?.className).not.toContain("border-semantic-error");
    cleanup();
  });

  it("should forward ref to the input element", () => {
    let inputRef: HTMLInputElement | null = null;
    const { cleanup } = render(
      <TextInput
        ref={(el) => {
          inputRef = el;
        }}
      />,
    );
    expect(inputRef).toBeInstanceOf(HTMLInputElement);
    cleanup();
  });

  it("should apply additional className", () => {
    const { container, cleanup } = render(<TextInput className="extra-class" />);
    const input = container.querySelector("input");
    expect(input?.className).toContain("extra-class");
    cleanup();
  });

  it("should pass through native input props", () => {
    const { container, cleanup } = render(
      <TextInput type="email" maxLength={100} required readOnly />,
    );
    const input = container.querySelector("input");
    expect(input?.getAttribute("type")).toBe("email");
    expect(input?.getAttribute("maxlength")).toBe("100");
    expect(input?.required).toBe(true);
    expect(input?.readOnly).toBe(true);
    cleanup();
  });
});
