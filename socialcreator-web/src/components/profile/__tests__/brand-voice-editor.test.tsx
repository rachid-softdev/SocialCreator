/**
 * Tests for BrandVoiceEditor component
 *
 * Renders a textarea for brand voice description with character count
 * and max length enforcement.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, userEvent } from "@/components/__tests__/test-utils";
import { BrandVoiceEditor } from "../brand-voice-editor";

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

describe("BrandVoiceEditor", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
  };

  it("renders a label and textarea", () => {
    render(<BrandVoiceEditor {...defaultProps} />);
    expect(screen.getByLabelText("Brand Voice")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("displays character count", () => {
    render(<BrandVoiceEditor {...defaultProps} value="Hello" />);
    expect(screen.getByText("5/500")).toBeInTheDocument();
  });

  it("shows updated char count as user types", async () => {
    const onChange = vi.fn();
    render(<BrandVoiceEditor value="" onChange={onChange} />);

    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Hello");

    // onChange is called with each keystroke
    expect(onChange).toHaveBeenCalled();
  });

  it("enforces max length by slicing input", () => {
    const onChange = vi.fn();
    const longText = "A".repeat(600);

    render(<BrandVoiceEditor value="" onChange={onChange} maxLength={500} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: longText } });

    // onChange should have been called with the sliced value (max 500)
    const lastCallArg = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    // The component slices the value, so the last call should have max 500 chars
    expect(lastCallArg?.length).toBeLessThanOrEqual(500);
  });

  it("applies error styling when near the character limit (>= 90%)", () => {
    const nearLimit = "A".repeat(450);
    render(<BrandVoiceEditor {...defaultProps} value={nearLimit} maxLength={500} />);

    // The char count should be displayed with error styling class for near limit
    const charCount = screen.getByText("450/500");
    // Near limit should use semantic-error color classes
    expect(charCount.className).toContain("semantic-error");
  });

  it("does not apply error styling when below 90% of max length", () => {
    const lowValue = "A".repeat(100);
    render(<BrandVoiceEditor {...defaultProps} value={lowValue} maxLength={500} />);

    const charCount = screen.getByText("100/500");
    expect(charCount.className).toContain("muted-soft");
  });

  it("renders with default placeholder", () => {
    render(<BrandVoiceEditor {...defaultProps} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("placeholder");
  });

  it("supports custom placeholder", () => {
    render(<BrandVoiceEditor {...defaultProps} placeholder="Custom placeholder" />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("placeholder", "Custom placeholder");
  });
});
