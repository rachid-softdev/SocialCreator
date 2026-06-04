/**
 * Tests for UploadButton component
 *
 * Renders a button that opens a hidden file picker on click.
 * Supports accept attribute and disabled state.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/components/__tests__/test-utils";
import { UploadButton } from "../upload-button";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  Upload: ({ className }: any) => (
    <span data-testid="icon-upload" className={className}>
      svg-upload
    </span>
  ),
}));

// ── Tests ─────────────────────────────────────────────────────────────────

describe("UploadButton", () => {
  const onFileSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a button with upload text", () => {
    render(<UploadButton onFileSelect={onFileSelect} />);

    expect(screen.getByText("Upload Video")).toBeInTheDocument();
  });

  it("renders the Upload icon", () => {
    render(<UploadButton onFileSelect={onFileSelect} />);

    expect(screen.getByText("svg-upload")).toBeInTheDocument();
  });

  it("has a hidden file input", () => {
    const { container } = render(<UploadButton onFileSelect={onFileSelect} />);

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveClass("hidden");
  });

  it("accepts video/* files by default", () => {
    const { container } = render(<UploadButton onFileSelect={onFileSelect} />);

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toHaveAttribute("accept", "video/mp4,video/quicktime,video/webm");
  });

  it("supports custom accept attribute", () => {
    const { container } = render(<UploadButton onFileSelect={onFileSelect} accept="image/*" />);

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toHaveAttribute("accept", "image/*");
  });

  it("clicks the hidden file input when button is clicked", async () => {
    const { container } = render(<UploadButton onFileSelect={onFileSelect} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    await userEvent.click(screen.getByText("Upload Video"));

    expect(clickSpy).toHaveBeenCalled();
  });

  it("calls onFileSelect when a file is selected", async () => {
    const { container } = render(<UploadButton onFileSelect={onFileSelect} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["test"], "video.mp4", { type: "video/mp4" });

    await userEvent.upload(fileInput, file);

    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it("renders disabled button when disabled prop is true", () => {
    render(<UploadButton onFileSelect={onFileSelect} disabled={true} />);

    const button = screen.getByText("Upload Video");
    expect(button).toBeDisabled();
  });

  it("applies disabled styling classes", () => {
    render(<UploadButton onFileSelect={onFileSelect} disabled={true} />);

    const button = screen.getByText("Upload Video");
    expect(button.className).toContain("opacity-50");
    expect(button.className).toContain("cursor-not-allowed");
  });

  it("does not open file picker when disabled", async () => {
    const { container } = render(<UploadButton onFileSelect={onFileSelect} disabled={true} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    await userEvent.click(screen.getByText("Upload Video"));

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("resets file input value after selection", async () => {
    const { container } = render(<UploadButton onFileSelect={onFileSelect} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["test"], "video.mp4", { type: "video/mp4" });

    await userEvent.upload(fileInput, file);

    // After upload, the value should be cleared so the same file can be selected again
    expect(fileInput.value).toBe("");
  });
});
