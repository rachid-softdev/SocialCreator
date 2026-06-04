/**
 * Tests for ProfileForm component
 *
 * Renders a form with name input, brand voice editor, content bank editor,
 * platform toggle buttons, and submit/cancel buttons.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/components/__tests__/test-utils";
import { ProfileForm } from "../profile-form";

// ── Mocks ────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush, back: mockBack })),
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@socialcreator/ui/text-input", () => ({
  TextInput: ({ id, value, onChange, placeholder, error, className, ...props }: any) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      data-error={error ? "true" : undefined}
      className={className}
      {...props}
    />
  ),
}));

vi.mock("@socialcreator/types/profile", () => ({
  PLATFORMS: [
    { value: "X", label: "X (Twitter)", icon: "X-icon" },
    { value: "LINKEDIN", label: "LinkedIn", icon: "LI-icon" },
    { value: "INSTAGRAM", label: "Instagram", icon: "IG-icon" },
    { value: "TIKTOK", label: "TikTok", icon: "TT-icon" },
    { value: "FACEBOOK", label: "Facebook", icon: "FB-icon" },
    { value: "YOUTUBE", label: "YouTube", icon: "YT-icon" },
    { value: "THREADS", label: "Threads", icon: "TH-icon" },
    { value: "PINTEREST", label: "Pinterest", icon: "PI-icon" },
  ],
}));

vi.mock("lucide-react", () => ({
  Loader2: "svg-loader",
}));

// Mock child components to avoid import chains
vi.mock("../brand-voice-editor", () => ({
  BrandVoiceEditor: ({ value, onChange }: any) => (
    <div data-testid="brand-voice-editor">
      <textarea
        data-testid="brand-voice-textarea"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      />
    </div>
  ),
}));

vi.mock("../content-bank-editor", () => ({
  ContentBankEditor: ({ value, onChange }: any) => (
    <div data-testid="content-bank-editor">
      <textarea
        data-testid="content-bank-textarea"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      />
    </div>
  ),
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// ── Tests ─────────────────────────────────────────────────────────────────

describe("ProfileForm", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the name input field", () => {
    render(<ProfileForm onSubmit={mockOnSubmit} />);
    expect(screen.getByLabelText(/Profile Name/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("My Brand")).toBeInTheDocument();
  });

  it("renders brand voice and content bank editors", () => {
    render(<ProfileForm onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("brand-voice-editor")).toBeInTheDocument();
    expect(screen.getByTestId("content-bank-editor")).toBeInTheDocument();
  });

  it("renders platform toggle buttons", () => {
    render(<ProfileForm onSubmit={mockOnSubmit} />);
    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
  });

  it("renders submit button with 'Create Profile' text when no initialData", () => {
    render(<ProfileForm onSubmit={mockOnSubmit} />);
    expect(screen.getByText("Create Profile")).toBeInTheDocument();
  });

  it("renders submit button with 'Update Profile' text when initialData has id", () => {
    render(
      <ProfileForm
        onSubmit={mockOnSubmit}
        initialData={{
          id: "profile-1",
          name: "Test",
          brandVoice: "",
          contentBank: "",
          platforms: [],
        }}
      />,
    );
    expect(screen.getByText("Update Profile")).toBeInTheDocument();
  });

  it("shows validation error when name is too short", async () => {
    render(<ProfileForm onSubmit={mockOnSubmit} />);
    const submitBtn = screen.getByText("Create Profile");
    await userEvent.click(submitBtn);
    expect(screen.getByText("Name must be at least 2 characters")).toBeInTheDocument();
  });

  it("shows validation error when name exceeds 50 characters", async () => {
    render(<ProfileForm onSubmit={mockOnSubmit} />);
    const input = screen.getByLabelText(/Profile Name/);
    await userEvent.type(input, "A".repeat(51));
    const submitBtn = screen.getByText("Create Profile");
    await userEvent.click(submitBtn);
    expect(screen.getByText("Name must be less than 50 characters")).toBeInTheDocument();
  });

  it("calls onSubmit with form data when validation passes", async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    render(<ProfileForm onSubmit={mockOnSubmit} />);

    const input = screen.getByLabelText(/Profile Name/);
    await userEvent.type(input, "My Brand");

    const submitBtn = screen.getByText("Create Profile");
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: "My Brand",
        brandVoice: "",
        contentBank: "",
        platforms: [],
      });
    });
  });

  it("shows loading state on submit button when isLoading is true", () => {
    render(<ProfileForm onSubmit={mockOnSubmit} isLoading={true} />);
    const submitBtn = screen.getByText("Create Profile");
    expect(submitBtn).toBeDisabled();
  });

  it("disables submit button while loading", () => {
    render(<ProfileForm onSubmit={mockOnSubmit} isLoading={true} />);
    const submitBtn = screen.getByText("Create Profile");
    expect(submitBtn).toBeDisabled();
  });

  it("displays error message when onSubmit throws", async () => {
    mockOnSubmit.mockRejectedValue(new Error("Network error"));
    render(<ProfileForm onSubmit={mockOnSubmit} />);

    const input = screen.getByLabelText(/Profile Name/);
    await userEvent.type(input, "My Brand");

    const submitBtn = screen.getByText("Create Profile");
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Failed to save profile. Please try again.")).toBeInTheDocument();
    });
  });

  it("toggles platform selection when clicking platform button", async () => {
    render(<ProfileForm onSubmit={mockOnSubmit} />);

    const xBtn = screen.getByText("X (Twitter)");
    await userEvent.click(xBtn);

    const input = screen.getByLabelText(/Profile Name/);
    await userEvent.type(input, "My Brand");

    const submitBtn = screen.getByText("Create Profile");
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({ platforms: ["X"] }));
    });
  });

  it("populates fields from initialData", () => {
    render(
      <ProfileForm
        onSubmit={mockOnSubmit}
        initialData={{
          id: "profile-1",
          name: "Existing Brand",
          brandVoice: "Professional tone",
          contentBank: "Some examples",
          platforms: ["X", "LINKEDIN"],
        }}
      />,
    );

    const input = screen.getByLabelText(/Profile Name/) as HTMLInputElement;
    expect(input.value).toBe("Existing Brand");
  });

  it("calls router.back when cancel is clicked", async () => {
    render(<ProfileForm onSubmit={mockOnSubmit} />);
    const cancelBtn = screen.getByText("Cancel");
    await userEvent.click(cancelBtn);
    expect(mockBack).toHaveBeenCalled();
  });
});
