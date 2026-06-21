/**
 * Tests for connection-toast helpers
 *
 * Verifies:
 * - showConnectionSuccess calls toast.success with correct message
 * - showConnectionError calls toast.error with correct message
 * - showDisconnectSuccess calls toast.success with correct message
 * - showDisconnectError calls toast.error with correct message
 * - Custom error messages are passed to toast
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted factories ─────────────────────────────────────────────────

const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

// ── Module-level mocks (hoisted) ──────────────────────────────────────

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

// ── Import after mocks ────────────────────────────────────────────────

import {
  showConnectionError,
  showConnectionSuccess,
  showDisconnectError,
  showDisconnectSuccess,
} from "../connection-toast";

// ── Tests ─────────────────────────────────────────────────────────────

describe("connection-toast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("showConnectionSuccess", () => {
    it("calls toast.success with platform name in message", () => {
      showConnectionSuccess("X");

      expect(mockToastSuccess).toHaveBeenCalledWith(
        "X account connected successfully!",
        expect.objectContaining({
          description: "Your account has been linked and is ready to use.",
          duration: 5000,
        }),
      );
    });

    it("calls toast.success with different platform names", () => {
      showConnectionSuccess("LinkedIn");

      expect(mockToastSuccess).toHaveBeenCalledWith(
        "LinkedIn account connected successfully!",
        expect.any(Object),
      );
    });
  });

  describe("showConnectionError", () => {
    it("calls toast.error with platform name in message", () => {
      showConnectionError("X");

      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to connect X",
        expect.objectContaining({
          description: "An error occurred while connecting your account. Please try again.",
          duration: 5000,
        }),
      );
    });

    it("passes custom error message when provided", () => {
      showConnectionError("Instagram", "Token expired");

      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to connect Instagram",
        expect.objectContaining({
          description: "Token expired",
          duration: 5000,
        }),
      );
    });

    it("uses default error message when no errorMessage provided", () => {
      showConnectionError("TikTok");

      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to connect TikTok",
        expect.objectContaining({
          description: "An error occurred while connecting your account. Please try again.",
        }),
      );
    });
  });

  describe("showDisconnectSuccess", () => {
    it("calls toast.success with platform name in message", () => {
      showDisconnectSuccess("X");

      expect(mockToastSuccess).toHaveBeenCalledWith(
        "X account disconnected",
        expect.objectContaining({
          description: "The account has been disconnected successfully.",
          duration: 5000,
        }),
      );
    });
  });

  describe("showDisconnectError", () => {
    it("calls toast.error with platform name in message", () => {
      showDisconnectError("X");

      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to disconnect X",
        expect.objectContaining({
          description: "An error occurred while disconnecting your account. Please try again.",
          duration: 5000,
        }),
      );
    });
  });
});
