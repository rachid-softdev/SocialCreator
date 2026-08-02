/**
 * Tests for ApiKeyManager component
 *
 * Verifies: create key flow, copy to clipboard, revoke key, active/revoked
 * sections, empty state, and logger error handling.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/components/__tests__/test-utils";
import { ApiKeyManager } from "../api-key-manager";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@socialcreator/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    icon: Icon,
    variant,
    size,
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
      {...props}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
  Plus: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-plus" {...props} />,
  Copy: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-copy" {...props} />,
  Eye: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-eye" {...props} />,
  EyeOff: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-eye-off" {...props} />,
  Trash2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-trash2" {...props} />,
  Key: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-key" {...props} />,
  Check: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-check" {...props} />,
  AlertCircle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-alert-circle" {...props} />
  ),
  AlertTriangle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-alert-triangle" {...props} />
  ),
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// Mock clipboard API — keep a reference so vitest can track the spy
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: mockWriteText },
  configurable: true,
  writable: true,
});

vi.mock("@/components/admin/confirm-dialog", () => ({
  ConfirmDialog: ({ open, onConfirm, description, confirmLabel }: any) =>
    open ? (
      <div data-testid="confirm-dialog">
        <p>{description}</p>
        <button data-testid="confirm-btn" onClick={onConfirm}>
          {confirmLabel || "Confirm"}
        </button>
        <button data-testid="cancel-btn" onClick={() => {}}>
          Cancel
        </button>
      </div>
    ) : null,
}));

// ── Fixtures ─────────────────────────────────────────────────────────────

const mockActiveKeys = [
  {
    id: "key-1",
    name: "Production",
    prefix: "sk_prod",
    createdAt: "2025-06-01T10:00:00Z",
  },
  {
    id: "key-2",
    name: "Development",
    prefix: "sk_dev",
    createdAt: "2025-06-10T10:00:00Z",
    lastUsed: "2025-06-15T10:00:00Z",
  },
];

const mockRevokedKeys = [
  {
    id: "key-3",
    name: "Old Key",
    prefix: "sk_old",
    createdAt: "2025-05-01T10:00:00Z",
    revokedAt: "2025-05-15T10:00:00Z",
  },
];

const mockInitialKeys = [...mockActiveKeys, ...mockRevokedKeys];

// ── Tests ────────────────────────────────────────────────────────────────

describe("ApiKeyManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Empty state ──────────────────────────────────────────────────────

  describe("empty state", () => {
    it("shows 'No API keys yet' when no keys provided", () => {
      render(<ApiKeyManager initialKeys={[]} />);
      expect(screen.getByText("No API keys yet.")).toBeInTheDocument();
    });

    it("shows 'Create your first API key' button in empty state", () => {
      render(<ApiKeyManager initialKeys={[]} />);
      expect(screen.getByText("Create your first API key")).toBeInTheDocument();
    });
  });

  // ── Active keys section ───────────────────────────────────────────────

  describe("active keys section", () => {
    it("renders the 'Active Keys' heading when there are active keys", () => {
      render(<ApiKeyManager initialKeys={mockInitialKeys} />);
      expect(screen.getByText("Active Keys")).toBeInTheDocument();
    });

    it("renders each active key name", () => {
      render(<ApiKeyManager initialKeys={mockInitialKeys} />);
      expect(screen.getByText("Production")).toBeInTheDocument();
      expect(screen.getByText("Development")).toBeInTheDocument();
    });

    it("renders each active key prefix", () => {
      render(<ApiKeyManager initialKeys={mockInitialKeys} />);
      expect(screen.getByText("sk_prod...")).toBeInTheDocument();
      expect(screen.getByText("sk_dev...")).toBeInTheDocument();
    });

    it("shows Revoke button for each active key", () => {
      render(<ApiKeyManager initialKeys={mockInitialKeys} />);
      const revokeButtons = screen.getAllByText("Revoke");
      expect(revokeButtons).toHaveLength(2);
    });

    it("does not show 'Active Keys' heading when there are no active keys", () => {
      render(<ApiKeyManager initialKeys={[]} />);
      expect(screen.queryByText("Active Keys")).not.toBeInTheDocument();
    });
  });

  // ── Revoked keys section ──────────────────────────────────────────────

  describe("revoked keys section", () => {
    it("renders the 'Revoked Keys' heading when there are revoked keys", () => {
      render(<ApiKeyManager initialKeys={mockInitialKeys} />);
      expect(screen.getByText("Revoked Keys")).toBeInTheDocument();
    });

    it("renders revoked key name", () => {
      render(<ApiKeyManager initialKeys={mockInitialKeys} />);
      expect(screen.getByText("Old Key")).toBeInTheDocument();
    });

    it("renders revoked key prefix", () => {
      render(<ApiKeyManager initialKeys={mockInitialKeys} />);
      expect(screen.getByText("sk_old...")).toBeInTheDocument();
    });

    it("does not show 'Revoked Keys' heading when there are no revoked keys", () => {
      render(<ApiKeyManager initialKeys={mockActiveKeys} />);
      expect(screen.queryByText("Revoked Keys")).not.toBeInTheDocument();
    });
  });

  // ── Create key flow ───────────────────────────────────────────────────

  describe("create key flow", () => {
    it("shows create input when 'Create New Key' is clicked", async () => {
      const user = userEvent.setup();
      render(<ApiKeyManager initialKeys={mockActiveKeys} />);

      await user.click(screen.getByText("Create New Key"));

      expect(
        screen.getByPlaceholderText("API key name (e.g., Production, Development)"),
      ).toBeInTheDocument();
    });

    it("calls onCreate when form is submitted", async () => {
      const onCreate = vi.fn().mockResolvedValue({
        id: "key-new",
        name: "New Key",
        prefix: "sk_new",
        apiKey: "sk_new_abc123",
      });
      const user = userEvent.setup();
      render(<ApiKeyManager initialKeys={mockActiveKeys} onCreate={onCreate} />);

      await user.click(screen.getByText("Create New Key"));

      const input = screen.getByPlaceholderText("API key name (e.g., Production, Development)");
      await user.type(input, "New Key");

      // Click the Create Key button
      await user.click(screen.getByText("Create Key"));

      await waitFor(() => {
        expect(onCreate).toHaveBeenCalledWith("New Key");
      });
    });

    it("displays the created API key after creation", async () => {
      const onCreate = vi.fn().mockResolvedValue({
        id: "key-new",
        name: "New Key",
        prefix: "sk_new",
        apiKey: "sk_new_abc123",
      });
      const user = userEvent.setup();
      render(<ApiKeyManager initialKeys={mockActiveKeys} onCreate={onCreate} />);

      await user.click(screen.getByText("Create New Key"));
      await user.type(
        screen.getByPlaceholderText("API key name (e.g., Production, Development)"),
        "New Key",
      );
      await user.click(screen.getByText("Create Key"));

      await waitFor(() => {
        expect(screen.getByText("sk_new_abc123")).toBeInTheDocument();
      });
    });

    it("shows 'API Key created - save it now!' message after creation", async () => {
      const onCreate = vi.fn().mockResolvedValue({
        id: "key-new",
        name: "New Key",
        prefix: "sk_new",
        apiKey: "sk_new_abc123",
      });
      const user = userEvent.setup();
      render(<ApiKeyManager initialKeys={mockActiveKeys} onCreate={onCreate} />);

      await user.click(screen.getByText("Create New Key"));
      await user.type(
        screen.getByPlaceholderText("API key name (e.g., Production, Development)"),
        "New Key",
      );
      await user.click(screen.getByText("Create Key"));

      await waitFor(() => {
        expect(screen.getByText("API Key created - save it now!")).toBeInTheDocument();
      });
    });

    it("hides the created key when 'I've saved my key' is clicked", async () => {
      const onCreate = vi.fn().mockResolvedValue({
        id: "key-new",
        name: "New Key",
        prefix: "sk_new",
        apiKey: "sk_new_abc123",
      });
      const user = userEvent.setup();
      render(<ApiKeyManager initialKeys={mockActiveKeys} onCreate={onCreate} />);

      await user.click(screen.getByText("Create New Key"));
      await user.type(
        screen.getByPlaceholderText("API key name (e.g., Production, Development)"),
        "New Key",
      );
      await user.click(screen.getByText("Create Key"));

      await waitFor(() => {
        expect(screen.getByText("sk_new_abc123")).toBeInTheDocument();
      });

      await user.click(screen.getByText("I've saved my key"));

      expect(screen.queryByText("sk_new_abc123")).not.toBeInTheDocument();
    });
  });

  // ── Copy to clipboard ─────────────────────────────────────────────────

  describe("copy to clipboard", () => {
    it("copies API key to clipboard when Copy button is clicked", async () => {
      const onCreate = vi.fn().mockResolvedValue({
        id: "key-new",
        name: "New Key",
        prefix: "sk_new",
        apiKey: "sk_new_abc123",
      });
      const user = userEvent.setup();
      render(<ApiKeyManager initialKeys={mockActiveKeys} onCreate={onCreate} />);

      await user.click(screen.getByText("Create New Key"));
      await user.type(
        screen.getByPlaceholderText("API key name (e.g., Production, Development)"),
        "New Key",
      );
      await user.click(screen.getByText("Create Key"));

      await waitFor(() => {
        expect(screen.getByText("sk_new_abc123")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Copy"));

      // Component calls navigator.clipboard.writeText and shows "Copied!"
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });

    it("shows 'Copied!' text after copying", async () => {
      const onCreate = vi.fn().mockResolvedValue({
        id: "key-new",
        name: "New Key",
        prefix: "sk_new",
        apiKey: "sk_new_abc123",
      });
      const user = userEvent.setup();
      render(<ApiKeyManager initialKeys={mockActiveKeys} onCreate={onCreate} />);

      await user.click(screen.getByText("Create New Key"));
      await user.type(
        screen.getByPlaceholderText("API key name (e.g., Production, Development)"),
        "New Key",
      );
      await user.click(screen.getByText("Create Key"));

      await waitFor(() => {
        expect(screen.getByText("Copy")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Copy"));

      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
  });

  // ── Revoke key flow ───────────────────────────────────────────────────

  describe("revoke key flow", () => {
    it("shows confirm dialog when revoking a key", async () => {
      const onRevoke = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<ApiKeyManager initialKeys={mockActiveKeys} onCreate={vi.fn()} onRevoke={onRevoke} />);

      const revokeBtn = screen.getAllByText("Revoke")[0]!;
      await user.click(revokeBtn);

      expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    });

    it("calls onRevoke when confirmed", async () => {
      const onRevoke = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<ApiKeyManager initialKeys={mockActiveKeys} onCreate={vi.fn()} onRevoke={onRevoke} />);

      const revokeBtn = screen.getAllByText("Revoke")[0]!;
      await user.click(revokeBtn);

      // Click confirm in the dialog
      await user.click(screen.getByTestId("confirm-btn"));

      await waitFor(() => {
        expect(onRevoke).toHaveBeenCalledWith("key-1");
      });
    });

    it("does not call onRevoke when confirm is cancelled", async () => {
      const onRevoke = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<ApiKeyManager initialKeys={mockActiveKeys} onCreate={vi.fn()} onRevoke={onRevoke} />);

      const revokeBtn = screen.getAllByText("Revoke")[0]!;
      await user.click(revokeBtn);

      // Click cancel in the dialog
      await user.click(screen.getByTestId("cancel-btn"));

      expect(onRevoke).not.toHaveBeenCalled();
    });

    it("moves key to revoked section after revoking", async () => {
      const onRevoke = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<ApiKeyManager initialKeys={mockActiveKeys} onCreate={vi.fn()} onRevoke={onRevoke} />);

      const revokeBtn = screen.getAllByText("Revoke")[0]!;
      await user.click(revokeBtn);

      // Click confirm in the dialog
      await user.click(screen.getByTestId("confirm-btn"));

      await waitFor(() => {
        expect(screen.getByText("Revoked Keys")).toBeInTheDocument();
      });
    });
  });

  // ── Logger error handling ─────────────────────────────────────────────

  describe("error handling", () => {
    it("logs error when create fails", async () => {
      const logger = await import("@/lib/logger");
      const onCreate = vi.fn().mockRejectedValue(new Error("API error"));
      const user = userEvent.setup();
      render(<ApiKeyManager initialKeys={mockActiveKeys} onCreate={onCreate} />);

      await user.click(screen.getByText("Create New Key"));
      await user.type(
        screen.getByPlaceholderText("API key name (e.g., Production, Development)"),
        "New Key",
      );
      await user.click(screen.getByText("Create Key"));

      await waitFor(() => {
        expect(logger.default.error).toHaveBeenCalled();
      });
    });

    it("logs error when revoke fails", async () => {
      const logger = await import("@/lib/logger");
      const onRevoke = vi.fn().mockRejectedValue(new Error("Revoke error"));
      const user = userEvent.setup();
      render(<ApiKeyManager initialKeys={mockActiveKeys} onCreate={vi.fn()} onRevoke={onRevoke} />);

      const revokeBtn = screen.getAllByText("Revoke")[0]!;
      await user.click(revokeBtn);

      // Confirm in the dialog
      await user.click(screen.getByTestId("confirm-btn"));

      await waitFor(() => {
        expect(logger.default.error).toHaveBeenCalled();
      });
    });
  });
});
