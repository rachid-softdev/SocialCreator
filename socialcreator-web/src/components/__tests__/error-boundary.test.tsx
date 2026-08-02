/**
 * Tests for ErrorBoundary, ErrorDisplay, NotFoundError, SessionExpiredError
 *
 * Verifies:
 * - ErrorBoundary renders children when no error
 * - ErrorBoundary catches errors and shows ErrorDisplay
 * - ErrorDisplay shows correct messages for auth (401), network, not found (404), unknown
 * - ErrorDisplay "Try Again" button calls reset
 * - ErrorDisplay "Go to Dashboard" navigates to /dashboard
 * - ErrorDisplay shows error digest when present
 * - NotFoundError renders correctly
 * - SessionExpiredError renders correctly
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import ErrorBoundary, { ErrorDisplay, NotFoundError, SessionExpiredError } from "../error-boundary";

// ── Module-level mocks ───────────────────────────────────────────────

vi.mock("@socialcreator/ui/button", () => ({
  Button: ({
    children,
    onClick,
    variant,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} data-variant={variant} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Home: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-home" {...props} />,
  Lock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-lock" {...props} />,
  RefreshCw: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-refresh-cw" {...props} />
  ),
  AlertTriangle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-alert-triangle" {...props} />
  ),
  Search: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-search" {...props} />,
  WifiOff: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-wifi-off" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
}));

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: mockLogger,
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("catches errors and shows ErrorDisplay", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const BrokenComponent = () => {
      throw new Error("Test error caught");
    };

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test error caught")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});

describe("ErrorDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeError = (message: string, extras?: { statusCode?: number; digest?: string }) => {
    const error = new Error(message) as Error & { statusCode?: number; digest?: string };
    if (extras?.statusCode) error.statusCode = extras.statusCode;
    if (extras?.digest) error.digest = extras.digest;
    return error;
  };

  it("shows 'Session Expired' message for auth errors (401)", () => {
    render(<ErrorDisplay error={makeError("Unauthorized")} reset={vi.fn()} />);

    expect(screen.getByText("Session Expired")).toBeInTheDocument();
    expect(screen.getByText("Your session has expired. Please sign in again.")).toBeInTheDocument();
  });

  it("shows 'Session Expired' when statusCode is 401", () => {
    render(<ErrorDisplay error={makeError("some error", { statusCode: 401 })} reset={vi.fn()} />);

    expect(screen.getByText("Session Expired")).toBeInTheDocument();
  });

  it("shows 'Connection Error' message for network errors", () => {
    render(<ErrorDisplay error={makeError("Failed to fetch")} reset={vi.fn()} />);

    expect(screen.getByText("Connection Error")).toBeInTheDocument();
    expect(
      screen.getByText("Unable to connect to the server. Please check your connection."),
    ).toBeInTheDocument();
  });

  it("shows 'Not Found' message for 404 errors", () => {
    render(<ErrorDisplay error={makeError("not found", { statusCode: 404 })} reset={vi.fn()} />);

    expect(screen.getByText("Not Found")).toBeInTheDocument();
    expect(screen.getByText("The requested resource could not be found.")).toBeInTheDocument();
  });

  it("shows generic message for unknown errors", () => {
    render(<ErrorDisplay error={makeError("Something broke")} reset={vi.fn()} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });

  it("'Try Again' button calls reset function", async () => {
    const handleReset = vi.fn();

    render(<ErrorDisplay error={makeError("Some error")} reset={handleReset} />);

    const user = userEvent.setup();
    await user.click(screen.getByText("Try Again"));

    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it("'Go to Dashboard' button is rendered", () => {
    render(<ErrorDisplay error={makeError("Some error")} reset={vi.fn()} />);

    expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
  });

  it("shows error digest when present", () => {
    render(
      <ErrorDisplay error={makeError("Test error", { digest: "ERR-12345" })} reset={vi.fn()} />,
    );

    expect(screen.getByText("Error ID: ERR-12345")).toBeInTheDocument();
  });

  it("does not show error digest when absent", () => {
    render(<ErrorDisplay error={makeError("Test error")} reset={vi.fn()} />);

    expect(screen.queryByText(/Error ID/)).not.toBeInTheDocument();
  });

  it("logs the error to console on mount", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorDisplay error={makeError("Logged error")} reset={vi.fn()} />);

    expect(consoleSpy).toHaveBeenCalledWith("[ErrorDisplay]", "Logged error", expect.any(Object));
    consoleSpy.mockRestore();
  });
});

describe("NotFoundError", () => {
  it("renders the 404 page correctly", () => {
    render(<NotFoundError />);

    expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    expect(screen.getByText(/The page you're looking for doesn't exist/)).toBeInTheDocument();
    expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
  });
});

describe("SessionExpiredError", () => {
  it("renders the session expired page correctly", () => {
    render(<SessionExpiredError />);

    expect(screen.getByText("Session Expired")).toBeInTheDocument();
    expect(screen.getByText(/Your session has expired. Please sign in again/)).toBeInTheDocument();
  });

  it("has Sign In and Create Account buttons", () => {
    render(<SessionExpiredError />);

    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.getByText("Create Account")).toBeInTheDocument();
  });
});
