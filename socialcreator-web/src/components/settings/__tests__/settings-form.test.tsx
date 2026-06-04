/**
 * Tests for SettingsForm component
 *
 * Renders a tabbed settings form with General (name/email/save),
 * API Keys, Billing, and Account (delete) tabs.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/components/__tests__/test-utils";
import { SettingsForm } from "../settings-form";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@socialcreator/ui/button", () => ({
  Button: ({ children, onClick, disabled, variant, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: "svg-alert-triangle",
  CreditCard: "svg-credit-card",
  Key: "svg-key",
  User: "svg-user",
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// ── Tests ─────────────────────────────────────────────────────────────────

describe("SettingsForm", () => {
  const mockOnSave = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the General tab by default", () => {
    render(<SettingsForm onSave={mockOnSave} />);

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByText("Save changes")).toBeInTheDocument();
  });

  it("renders all four tab buttons", () => {
    render(<SettingsForm onSave={mockOnSave} />);

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("API Keys")).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("highlights the active tab", () => {
    render(<SettingsForm onSave={mockOnSave} />);

    const generalTab = screen.getByText("General");
    // Active tab should have the border styling
    expect(generalTab.className).toContain("border-b-2");
  });

  it("switches to API Keys tab on click", async () => {
    render(<SettingsForm onSave={mockOnSave} />);

    await userEvent.click(screen.getByText("API Keys"));

    expect(screen.getByText(/Manage your API keys/)).toBeInTheDocument();
    expect(screen.getByText("Go to API Keys")).toBeInTheDocument();
  });

  it("switches to Billing tab on click", async () => {
    render(<SettingsForm onSave={mockOnSave} />);

    await userEvent.click(screen.getByText("Billing"));

    expect(screen.getByText(/Manage your subscription/)).toBeInTheDocument();
    expect(screen.getByText("Go to Billing")).toBeInTheDocument();
  });

  it("switches to Account tab and shows delete section", async () => {
    render(<SettingsForm onSave={mockOnSave} />);

    await userEvent.click(screen.getByText("Account"));

    expect(screen.getByText("Delete account")).toBeInTheDocument();
    expect(screen.getByText("Delete my account")).toBeInTheDocument();
  });

  it("calls onSave with name and email when save is clicked", async () => {
    mockOnSave.mockResolvedValue(undefined);
    render(<SettingsForm onSave={mockOnSave} />);

    const nameInput = screen.getByLabelText("Name");
    const emailInput = screen.getByLabelText("Email");

    await userEvent.type(nameInput, "John Doe");
    await userEvent.type(emailInput, "john@example.com");

    await userEvent.click(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: "John Doe",
        email: "john@example.com",
      });
    });
  });

  it("shows saving state on button when saving", async () => {
    // Keep promise pending to show loading state
    mockOnSave.mockImplementation(() => new Promise(() => {}));

    render(<SettingsForm onSave={mockOnSave} />);

    await userEvent.type(screen.getByLabelText("Name"), "John");
    await userEvent.click(screen.getByText("Save changes"));

    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("disables save button while saving", async () => {
    mockOnSave.mockImplementation(() => new Promise(() => {}));

    render(<SettingsForm onSave={mockOnSave} />);

    await userEvent.type(screen.getByLabelText("Name"), "John");
    await userEvent.click(screen.getByText("Save changes"));

    expect(screen.getByText("Saving...")).toBeDisabled();
  });

  it("shows delete confirmation on clicking Delete my account", async () => {
    render(<SettingsForm onSave={mockOnSave} />);

    await userEvent.click(screen.getByText("Account"));
    await userEvent.click(screen.getByText("Delete my account"));

    expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
    expect(screen.getByText("Yes, delete everything")).toBeInTheDocument();
  });

  it("calls onDeleteAccount when confirmed", async () => {
    mockOnDelete.mockResolvedValue(undefined);
    render(<SettingsForm onSave={mockOnSave} onDeleteAccount={mockOnDelete} />);

    await userEvent.click(screen.getByText("Account"));
    await userEvent.click(screen.getByText("Delete my account"));
    await userEvent.click(screen.getByText("Yes, delete everything"));

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalled();
    });
  });

  it("shows deleting state on confirm button", async () => {
    mockOnDelete.mockImplementation(() => new Promise(() => {}));

    render(<SettingsForm onSave={mockOnSave} onDeleteAccount={mockOnDelete} />);

    await userEvent.click(screen.getByText("Account"));
    await userEvent.click(screen.getByText("Delete my account"));

    await userEvent.click(screen.getByText("Yes, delete everything"));

    expect(screen.getByText("Deleting...")).toBeInTheDocument();
  });

  it("has an API keys link in API Keys tab", async () => {
    render(<SettingsForm onSave={mockOnSave} />);

    await userEvent.click(screen.getByText("API Keys"));

    const link = screen.getByText("Go to API Keys");
    expect(link.closest("a")).toHaveAttribute("href", "/settings/api-keys");
  });

  it("has a billing link in Billing tab", async () => {
    render(<SettingsForm onSave={mockOnSave} />);

    await userEvent.click(screen.getByText("Billing"));

    const link = screen.getByText("Go to Billing");
    expect(link.closest("a")).toHaveAttribute("href", "/settings/billing");
  });
});
