// @vitest-environment jsdom
/**
 * Tests for useToast hook and related toast utilities
 *
 * Covers:
 * - useToast methods (success, error, info, warning, dismiss)
 * - toastPromise standalone function
 * - handleApiError (Response, Error, unknown)
 * - handleApiSuccess
 */

import { act, renderHook } from "@testing-library/react";
import { toast as sonnerToast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleApiError, handleApiSuccess, toastPromise, useToast } from "../use-toast";

// ── Mock sonner toast ──────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(
      (promise: Promise<unknown>, opts: { loading: string; success: string; error: string }) =>
        promise,
    ),
  },
}));

const mockToast = vi.mocked(sonnerToast);

// ── Helper ─────────────────────────────────────────────────────────────────

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("useToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("success", () => {
    it("should call sonnerToast.success with title and default duration", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.success("Created!");
      });

      expect(mockToast.success).toHaveBeenCalledWith("Created!", {
        description: undefined,
        duration: 5000,
      });
    });

    it("should call sonnerToast.success with title, description, and custom duration", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.success("Updated!", {
          description: "Your profile was updated",
          duration: 3000,
        });
      });

      expect(mockToast.success).toHaveBeenCalledWith("Updated!", {
        description: "Your profile was updated",
        duration: 3000,
      });
    });
  });

  describe("error", () => {
    it("should call sonnerToast.error with title and default duration", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.error("Failed!");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Failed!", {
        description: undefined,
        duration: 7000,
      });
    });

    it("should call sonnerToast.error with title and description", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.error("Failed!", { description: "Something went wrong" });
      });

      expect(mockToast.error).toHaveBeenCalledWith("Failed!", {
        description: "Something went wrong",
        duration: 7000,
      });
    });
  });

  describe("info", () => {
    it("should call sonnerToast.info with title and default duration", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.info("Heads up!");
      });

      expect(mockToast.info).toHaveBeenCalledWith("Heads up!", {
        description: undefined,
        duration: 5000,
      });
    });
  });

  describe("warning", () => {
    it("should call sonnerToast.warning with title and default duration", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.warning("Caution!");
      });

      expect(mockToast.warning).toHaveBeenCalledWith("Caution!", {
        description: undefined,
        duration: 6000,
      });
    });
  });

  describe("dismiss", () => {
    it("should call sonnerToast.dismiss()", () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.dismiss();
      });

      expect(mockToast.dismiss).toHaveBeenCalledOnce();
    });
  });
});

// ── toastPromise ───────────────────────────────────────────────────────────

describe("toastPromise", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call sonnerToast.promise with correct messages", async () => {
    const promise = Promise.resolve("done");
    const messages = {
      loading: "Saving...",
      success: "Saved!",
      error: "Save failed",
    };

    const result = await toastPromise(promise, messages);

    expect(mockToast.promise).toHaveBeenCalledWith(promise, {
      loading: "Saving...",
      success: "Saved!",
      error: "Save failed",
    });
    expect(result).toBe("done");
  });
});

// ── handleApiError ─────────────────────────────────────────────────────────

describe("handleApiError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse Response.json.error and show error toast", async () => {
    const response = new Response(JSON.stringify({ error: "Not found" }), { status: 404 });

    handleApiError(response);
    await flushPromises();

    expect(mockToast.error).toHaveBeenCalledWith("Error", {
      description: "Not found",
    });
  });

  it("should parse Response.json.message as fallback", async () => {
    const response = new Response(JSON.stringify({ message: "Server error" }), { status: 500 });

    handleApiError(response);
    await flushPromises();

    expect(mockToast.error).toHaveBeenCalledWith("Error", {
      description: "Server error",
    });
  });

  it("should use fallback message when Response.json lacks error and message", async () => {
    const response = new Response(JSON.stringify({}), { status: 400 });

    handleApiError(response, "Custom fallback");
    await flushPromises();

    expect(mockToast.error).toHaveBeenCalledWith("Error", {
      description: "Custom fallback",
    });
  });

  it("should use default fallback when Response.json() fails", async () => {
    const response = new Response("not json", { status: 500 });

    handleApiError(response, "Parse failed");
    await flushPromises();

    expect(mockToast.error).toHaveBeenCalledWith("Error", {
      description: "Parse failed",
    });
  });

  it("should show Error.message for Error instances", () => {
    handleApiError(new Error("Something broke"));

    expect(mockToast.error).toHaveBeenCalledWith("Error", {
      description: "Something broke",
    });
  });

  it("should show fallback for unknown error types", () => {
    handleApiError("string error");

    expect(mockToast.error).toHaveBeenCalledWith("Error", {
      description: "An error occurred",
    });
  });

  it("should show custom fallback for unknown error types", () => {
    handleApiError(42, "Custom fallback");

    expect(mockToast.error).toHaveBeenCalledWith("Error", {
      description: "Custom fallback",
    });
  });

  it("should show fallback when Error.message is empty", () => {
    handleApiError(new Error(""), "Empty message fallback");

    expect(mockToast.error).toHaveBeenCalledWith("Error", {
      description: "Empty message fallback",
    });
  });
});

// ── handleApiSuccess ───────────────────────────────────────────────────────

describe("handleApiSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call sonnerToast.success with message", () => {
    handleApiSuccess("Profile saved");

    expect(mockToast.success).toHaveBeenCalledWith("Profile saved", {
      description: undefined,
    });
  });

  it("should call sonnerToast.success with message and description", () => {
    handleApiSuccess("Changes saved", "Your changes have been applied");

    expect(mockToast.success).toHaveBeenCalledWith("Changes saved", {
      description: "Your changes have been applied",
    });
  });
});
