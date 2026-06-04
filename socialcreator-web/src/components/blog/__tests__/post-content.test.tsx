/**
 * Tests for PostContent component
 *
 * Verifies: renders markdown content via react-markdown mock, passes children
 * to the mocked markdown renderer.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { PostContent } from "../post-content";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("react-markdown", () => ({
  default: ({ children }: any) => <div data-testid="markdown">{children}</div>,
}));

vi.mock("remark-gfm", () => ({
  default: () => {},
}));

vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: any) => <div data-testid="syntax-highlighter">{children}</div>,
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  vscDarkPlus: {},
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} data-testid="next-image" {...props} />
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────────

describe("PostContent", () => {
  it("renders the markdown container", () => {
    render(<PostContent content="# Hello World" />);
    expect(screen.getByTestId("markdown")).toBeInTheDocument();
  });

  it("passes content to react-markdown", () => {
    render(<PostContent content="# Hello World" />);
    expect(screen.getByTestId("markdown")).toHaveTextContent("# Hello World");
  });

  it("renders empty content without crashing", () => {
    render(<PostContent content="" />);
    expect(screen.getByTestId("markdown")).toBeInTheDocument();
  });

  it("renders multiline markdown content", () => {
    const multiline = "# Title\n\nThis is a paragraph.\n\n- Item 1\n- Item 2";
    render(<PostContent content={multiline} />);
    // textContent normalizes whitespace, so compare collapsed version
    expect(screen.getByTestId("markdown")).toHaveTextContent(
      "# Title This is a paragraph. - Item 1 - Item 2",
    );
  });

  it("renders the prose-blog wrapper", () => {
    const { container } = render(<PostContent content="Hello" />);
    expect(container.querySelector(".prose-blog")).toBeInTheDocument();
  });

  it("renders content with special characters", () => {
    const content = "Special: <>&\"'";
    render(<PostContent content={content} />);
    expect(screen.getByTestId("markdown")).toHaveTextContent(content);
  });
});
