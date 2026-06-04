/**
 * Tests for fetchWithTimeout utility
 * Wraps fetch() with an AbortSignal timeout to prevent hanging requests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "../fetch-timeout";

describe("fetchWithTimeout", () => {
  const mockResponse = { ok: true, status: 200, json: () => Promise.resolve({}) } as Response;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should return response when fetch completes before timeout", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValue(mockResponse);

    const response = await fetchWithTimeout("https://api.example.com/data", { timeout: 1000 });

    expect(response).toBe(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/data", expect.any(Object));
  });

  it("should pass through fetch options (method, headers, body)", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValue(mockResponse);

    await fetchWithTimeout("https://api.example.com/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "value" }),
      timeout: 500,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/data",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "value" }),
      }),
    );
  });

  it("should strip timeout from options passed to fetch", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValue(mockResponse);

    await fetchWithTimeout("https://api.example.com/data", { timeout: 500 });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/data",
      expect.not.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it("should work without specifying a timeout (uses default)", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValue(mockResponse);

    const response = await fetchWithTimeout("https://api.example.com/data");

    expect(response).toBe(mockResponse);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("should use custom timeout when provided", async () => {
    // Mock fetch to respect AbortSignal
    const mockFetch = vi.mocked(globalThis.fetch);
    let abortHandler: (() => void) | null = null;
    mockFetch.mockImplementation(
      (_input: string | URL | Request, opts: any) =>
        new Promise((_resolve, reject) => {
          const signal: AbortSignal = opts.signal;
          if (signal.aborted) {
            reject(new DOMException("The operation was aborted", "AbortError"));
            return;
          }
          abortHandler = () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          };
          signal.addEventListener("abort", abortHandler);
        }),
    );

    // Use a custom timeout that's short enough to test
    const promise = fetchWithTimeout("https://api.example.com/slow", { timeout: 10 });

    // Verify the timeout eventually aborts
    await expect(promise).rejects.toThrow();
  });

  it("should throw when fetch times out", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockImplementation(
      (_input: string | URL | Request, opts: any) =>
        new Promise((_resolve, reject) => {
          const signal: AbortSignal = opts.signal;
          if (signal.aborted) {
            reject(new DOMException("The operation was aborted", "AbortError"));
            return;
          }
          signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }),
    );

    await expect(
      fetchWithTimeout("https://api.example.com/slow", { timeout: 5 }),
    ).rejects.toThrow();
  });

  it("should throw AbortError on timeout", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockImplementation(
      (_input: string | URL | Request, opts: any) =>
        new Promise((_resolve, reject) => {
          const signal: AbortSignal = opts.signal;
          if (signal.aborted) {
            reject(new DOMException("The operation was aborted", "AbortError"));
            return;
          }
          signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }),
    );

    await expect(
      fetchWithTimeout("https://api.example.com/slow", { timeout: 5 }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("should handle zero timeout (immediate abort)", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockImplementation(
      (_input: string | URL | Request, opts: any) =>
        new Promise((_resolve, reject) => {
          const signal: AbortSignal = opts.signal;
          if (signal.aborted) {
            reject(new DOMException("The operation was aborted", "AbortError"));
            return;
          }
          signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }),
    );

    await expect(
      fetchWithTimeout("https://api.example.com/zero", { timeout: 0 }),
    ).rejects.toThrow();
  });

  it("should propagate fetch errors", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockRejectedValue(new Error("Network failure"));

    await expect(
      fetchWithTimeout("https://api.example.com/error", { timeout: 1000 }),
    ).rejects.toThrow("Network failure");
  });

  it("should pass AbortSignal to fetch", async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockImplementation(
      (_input: string | URL | Request, opts: any) =>
        new Promise((resolve) => {
          expect(opts.signal).toBeDefined();
          expect(opts.signal).toBeInstanceOf(AbortSignal);
          resolve(mockResponse);
        }),
    );

    await fetchWithTimeout("https://api.example.com/data", { timeout: 1000 });
  });
});
