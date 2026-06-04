/**
 * Tests for ContentBankEditor component
 *
 * Renders an editor for managing content examples with add/remove/tagging.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/components/__tests__/test-utils";
import { ContentBankEditor } from "../content-bank-editor";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@socialcreator/ui/button", () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@socialcreator/ui/badge-pill", () => ({
  BadgePill: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock("lucide-react", () => ({
  GripVertical: ({ className }: any) => (
    <span data-testid="icon-grip" className={className}>
      svg-grip
    </span>
  ),
  Plus: ({ className }: any) => (
    <span data-testid="icon-plus" className={className}>
      svg-plus
    </span>
  ),
  Tag: ({ className }: any) => (
    <span data-testid="icon-tag" className={className}>
      svg-tag
    </span>
  ),
  Trash2: ({ className }: any) => (
    <span data-testid="icon-trash2" className={className}>
      svg-trash2
    </span>
  ),
  X: ({ className }: any) => (
    <span data-testid="icon-x" className={className}>
      svg-x
    </span>
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────

const sampleJson = JSON.stringify([
  { id: "1", content: "First example post", tags: ["social"] },
  { id: "2", content: "Second example blog", tags: ["blog", "long-form"] },
]);

const samplePlainText = "Example paragraph one\n\nExample paragraph two\n\nExample paragraph three";

// ── Tests ─────────────────────────────────────────────────────────────────

describe("ContentBankEditor", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
  };

  it("renders the editor with label and description", () => {
    render(<ContentBankEditor {...defaultProps} />);
    expect(screen.getByText("Content Bank")).toBeInTheDocument();
    expect(screen.getByText(/Add examples of your best content/)).toBeInTheDocument();
  });

  it("shows 0 examples badge when empty", () => {
    render(<ContentBankEditor {...defaultProps} />);
    expect(screen.getByText("0 examples")).toBeInTheDocument();
  });

  it("renders an empty state with no example list when value is empty", () => {
    render(<ContentBankEditor {...defaultProps} />);
    expect(screen.queryByText("Your Examples")).not.toBeInTheDocument();
  });

  it("allows adding a new content example", async () => {
    const onChange = vi.fn();
    render(<ContentBankEditor value="" onChange={onChange} />);

    const textarea = screen.getByPlaceholderText(/Paste examples of your past content/);
    await userEvent.type(textarea, "My new example");

    const addBtn = screen.getByText("Add Example");
    await userEvent.click(addBtn);

    expect(onChange).toHaveBeenCalled();
    const callArg = onChange.mock.calls[0][0];
    const parsed = JSON.parse(callArg);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe("My new example");
  });

  it("does not add empty content", async () => {
    const onChange = vi.fn();
    render(<ContentBankEditor value="" onChange={onChange} />);

    const addBtn = screen.getByText("Add Example");
    expect(addBtn).toBeDisabled();
  });

  it("allows removing a content example", async () => {
    const onChange = vi.fn();
    render(<ContentBankEditor value={sampleJson} onChange={onChange} />);

    // Should show the examples
    expect(screen.getByText("2 examples")).toBeInTheDocument();
    expect(screen.getByText("Your Examples")).toBeInTheDocument();

    // Find and click the delete (Trash2) buttons
    const deleteButtons = screen.getAllByText("svg-trash2");
    await userEvent.click(deleteButtons[0]);

    expect(onChange).toHaveBeenCalled();
    const callArg = onChange.mock.calls[0][0];
    const parsed = JSON.parse(callArg);
    expect(parsed).toHaveLength(1);
  });

  it("parses initial JSON value into examples", () => {
    const onChange = vi.fn();
    render(<ContentBankEditor value={sampleJson} onChange={onChange} />);

    expect(screen.getByText("2 examples")).toBeInTheDocument();
    expect(screen.getByText("First example post")).toBeInTheDocument();
    expect(screen.getByText("Second example blog")).toBeInTheDocument();
  });

  it("parses plain text value into legacy examples", () => {
    render(<ContentBankEditor value={samplePlainText} onChange={vi.fn()} />);

    expect(screen.getByText("3 examples")).toBeInTheDocument();
    // Should show truncated versions of the text
    expect(screen.getByText("Example paragraph one")).toBeInTheDocument();
  });

  it("renders tips section", () => {
    render(<ContentBankEditor {...defaultProps} />);
    expect(screen.getByText("Tips")).toBeInTheDocument();
    expect(screen.getByText(/Add 5-10 examples/)).toBeInTheDocument();
  });

  it("disables Add Example button when textarea is empty", () => {
    render(<ContentBankEditor {...defaultProps} />);
    const addBtn = screen.getByText("Add Example");
    expect(addBtn).toBeDisabled();
  });

  it("renders tags for examples that have them", () => {
    render(<ContentBankEditor value={sampleJson} onChange={vi.fn()} />);
    expect(screen.getByText("social")).toBeInTheDocument();
    expect(screen.getByText("blog")).toBeInTheDocument();
    expect(screen.getByText("long-form")).toBeInTheDocument();
  });

  it("allows adding a tag to an example", async () => {
    const onChange = vi.fn();
    render(<ContentBankEditor value={sampleJson} onChange={onChange} />);

    // Find the tag input (there should be one per example)
    const tagInputs = screen.getAllByPlaceholderText("Add tag...");
    await userEvent.type(tagInputs[0], "new-tag");
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalled();
    const callArg = onChange.mock.calls[0][0];
    const parsed = JSON.parse(callArg);
    expect(parsed[0].tags).toContain("new-tag");
  });

  it("allows removing a tag from an example", async () => {
    const onChange = vi.fn();
    render(<ContentBankEditor value={sampleJson} onChange={onChange} />);

    // Find and click the X buttons on tags
    const removeTagButtons = screen.getAllByText("svg-x");
    await userEvent.click(removeTagButtons[0]);

    expect(onChange).toHaveBeenCalled();
    const callArg = onChange.mock.calls[0][0];
    const parsed = JSON.parse(callArg);
    expect(parsed[0].tags).not.toContain("social");
  });

  it("truncates long example content to 200 chars", () => {
    const longContent = "A".repeat(300);
    const jsonWithLong = JSON.stringify([{ id: "1", content: longContent, tags: [] }]);
    render(<ContentBankEditor value={jsonWithLong} onChange={vi.fn()} />);
    const displayedText = screen.getByText((content) => content.includes("..."));
    expect(displayedText).toBeInTheDocument();
  });
});
