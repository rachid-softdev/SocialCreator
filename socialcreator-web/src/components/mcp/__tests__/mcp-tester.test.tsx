/**
 * Tests for McpTester component
 *
 * Verifies: input API key, example request buttons, request textarea,
 * send request flow, response display, copy response, loading state.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/components/__tests__/test-utils";
import { McpTester } from "../mcp-tester";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@socialcreator/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    icon: Icon,
    variant,
    size,
    iconPosition,
    className,
    ...props
  }: any) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
      data-icon-position={iconPosition}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  ),
}));

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

// Mock clipboard API — keep a reference so vitest can track the spy
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: mockWriteText },
  configurable: true,
  writable: true,
});

// ── Fixtures ─────────────────────────────────────────────────────────────

const mockSuccessResponse = {
  jsonrpc: "2.0",
  id: 1,
  result: { profiles: [{ id: "p1", name: "Test Profile" }] },
};

const mockErrorResponse = {
  jsonrpc: "2.0",
  id: 1,
  error: { code: -32000, message: "Method not found" },
};

// ── Tests ────────────────────────────────────────────────────────────────

describe("McpTester", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the request textarea", () => {
    render(<McpTester />);
    expect(screen.getByLabelText("Request")).toBeInTheDocument();
  });

  it("renders the default JSON-RPC request", () => {
    render(<McpTester />);
    const textarea = screen.getByLabelText("Request") as HTMLTextAreaElement;
    expect(textarea.value).toContain('"jsonrpc": "2.0"');
    expect(textarea.value).toContain('"method": "list_profiles"');
  });

  it("renders the 'Send Request' button", () => {
    render(<McpTester />);
    expect(screen.getByText("Send Request")).toBeInTheDocument();
  });

  it("shows 'Response will appear here' initially", () => {
    render(<McpTester />);
    expect(screen.getByText("Response will appear here")).toBeInTheDocument();
  });

  it("renders example request buttons", () => {
    render(<McpTester />);
    expect(screen.getByText("List Profiles")).toBeInTheDocument();
    expect(screen.getByText("List Agents")).toBeInTheDocument();
    expect(screen.getByText("Create Agent")).toBeInTheDocument();
    expect(screen.getByText("Run Agent")).toBeInTheDocument();
    expect(screen.getByText("Get Run Status")).toBeInTheDocument();
  });

  it("updates request body when an example button is clicked", async () => {
    const user = userEvent.setup();
    render(<McpTester />);

    await user.click(screen.getByText("List Agents"));

    const textarea = screen.getByLabelText("Request") as HTMLTextAreaElement;
    expect(textarea.value).toContain('"method": "list_agents"');
  });

  it("sends a POST request when Send Request is clicked", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const user = userEvent.setup();
    render(<McpTester baseUrl="/api/mcp" />);

    await user.click(screen.getByText("Send Request"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "",
        },
        body: expect.any(String),
      });
    });
  });

  it("includes the API key in Authorization header when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const user = userEvent.setup();
    render(<McpTester baseUrl="/api/mcp" apiKey="sk_test_xyz" />);

    await user.click(screen.getByText("Send Request"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk_test_xyz",
        },
        body: expect.any(String),
      });
    });
  });

  it("displays the response after a successful request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const user = userEvent.setup();
    render(<McpTester />);

    await user.click(screen.getByText("Send Request"));

    await waitFor(() => {
      expect(screen.getByText(/Test Profile/)).toBeInTheDocument();
    });
  });

  it("shows loading state while request is in flight", async () => {
    // Create a promise that won't resolve during our check
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    const user = userEvent.setup();
    render(<McpTester />);

    await user.click(screen.getByText("Send Request"));

    expect(screen.getByText("Sending request...")).toBeInTheDocument();
  });

  it("shows 'Sending...' text on button during loading", async () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    const user = userEvent.setup();
    render(<McpTester />);

    await user.click(screen.getByText("Send Request"));

    expect(screen.getByText("Sending...")).toBeInTheDocument();
  });

  it("disables the Send Request button while loading", async () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    const user = userEvent.setup();
    render(<McpTester />);

    await user.click(screen.getByText("Send Request"));

    expect(screen.getByText("Sending...")).toBeDisabled();
  });

  it("displays error message when request fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const user = userEvent.setup();
    render(<McpTester />);

    await user.click(screen.getByText("Send Request"));

    await waitFor(() => {
      expect(screen.getByText(/"Network failure"/)).toBeInTheDocument();
    });
  });

  it("displays error response content when API returns an error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockErrorResponse,
    });

    const user = userEvent.setup();
    render(<McpTester />);

    await user.click(screen.getByText("Send Request"));

    await waitFor(() => {
      expect(screen.getByText(/Method not found/)).toBeInTheDocument();
    });
  });

  it("shows Copy button after receiving a response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const user = userEvent.setup();
    render(<McpTester />);

    await user.click(screen.getByText("Send Request"));

    await waitFor(() => {
      expect(screen.getByText("Copy")).toBeInTheDocument();
    });
  });

  it("copies response to clipboard when Copy is clicked", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const user = userEvent.setup();
    render(<McpTester />);

    await user.click(screen.getByText("Send Request"));

    await waitFor(() => {
      expect(screen.getByText("Copy")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Copy"));

    // Should show "Copied!" after clicking
    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });

  it("uses default baseUrl when not provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const user = userEvent.setup();
    render(<McpTester />);

    await user.click(screen.getByText("Send Request"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/mcp", expect.any(Object));
    });
  });
});
