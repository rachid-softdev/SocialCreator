import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPinterestBoard,
  getPinterestBoards,
  getPinterestProfile,
  publishToPinterest,
} from "../../publishers/pinterest";

vi.mock("@/lib/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { fetchWithTimeout } from "@/lib/fetch-timeout";

function createMockResponse(
  overrides: {
    ok?: boolean;
    status?: number;
    json?: unknown;
    text?: string;
    headers?: Record<string, string>;
  } = {},
): Response {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    json: vi.fn().mockResolvedValue(overrides.json ?? {}),
    text: vi.fn().mockResolvedValue(overrides.text ?? ""),
    blob: vi.fn(),
    headers: {
      get: vi.fn((name: string) => {
        const h = overrides.headers ?? {};
        return h[name] ?? null;
      }),
    },
  } as unknown as Response;
}

describe("publishToPinterest", () => {
  const mockContent = {
    textContent: "Beautiful pin description",
    mediaUrls: ["https://example.com/pin-image.jpg"],
    hashtags: ["pinterest", "diy"],
  };
  const mockAccount = {
    accountId: "board_123",
    accessToken: "pin-token",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("early validation", () => {
    it("should return error when no media URLs provided", async () => {
      const result = await publishToPinterest({ ...mockContent, mediaUrls: [] }, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Pinterest requires an image");
      // fetchWithTimeout should never be called
      expect(fetchWithTimeout).not.toHaveBeenCalled();
    });
  });

  describe("success", () => {
    it("should publish successfully", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "pin_123" } }));

      const result = await publishToPinterest(mockContent, mockAccount);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("pin_123");
      expect(result.postUrl).toBe("https://pin.it/pin_123");
    });

    it("should truncate title to 100 characters", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "pin_123" } }));

      const longText = "x".repeat(150);
      await publishToPinterest({ ...mockContent, textContent: longText }, mockAccount);

      const callArg = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(callArg.body as string);
      expect(body.title.length).toBe(100);
    });

    it("should include board_id in request body", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "pin_123" } }));

      await publishToPinterest(mockContent, mockAccount);

      const callArg = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(callArg.body as string);
      expect(body.board_id).toBe("board_123");
    });

    it("should include media URL as both link and mediaSource", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "pin_123" } }));

      await publishToPinterest(mockContent, mockAccount);

      const callArg = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(callArg.body as string);
      expect(body.link).toBe("https://example.com/pin-image.jpg");
      expect(body.mediaSource.source_type).toBe("image_url");
      expect(body.mediaSource.url).toBe("https://example.com/pin-image.jpg");
    });
  });

  describe("error code mapping", () => {
    it("should return 'Invalid board ID' for error code 5", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 400,
          json: { code: 5, error_message: "Board not found" },
        }),
      );

      const result = await publishToPinterest(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid board ID. Please reconnect your Pinterest account.");
    });

    it("should return 'Rate limit exceeded' for error code 2", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 429,
          json: { code: 2, error_message: "Too many requests" },
        }),
      );

      const result = await publishToPinterest(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Rate limit exceeded. Please try again later.");
    });

    it("should return generic error message for other errors", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 400,
          json: { error_message: "Invalid parameters" },
        }),
      );

      const result = await publishToPinterest(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Pinterest API error: 400");
    });

    it("should fall back to Pinterest API error with status when no error_message", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      // Status 400 so "400" doesn't match shouldRetry (500/503/network/ETIMEDOUT)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue(""),
        blob: vi.fn(),
        headers: { get: vi.fn() },
      } as unknown as Response);

      const result = await publishToPinterest(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Pinterest API error");
      expect(result.error).toContain("400");
    });
  });

  describe("retry logic", () => {
    it("should retry on transient error and recover", async () => {
      vi.useFakeTimers();
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockRejectedValueOnce(new Error("500 Internal Server Error"))
        .mockResolvedValueOnce(createMockResponse({ json: { id: "pin_123" } }));

      const promise = publishToPinterest(mockContent, mockAccount);

      // Advance past the retry delay (baseDelay * attempt = 1500 * 1)
      await vi.advanceTimersByTimeAsync(1500);

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.postId).toBe("pin_123");
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("should retry with increasing delay on multiple failures", async () => {
      vi.useFakeTimers();
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch
        .mockRejectedValueOnce(new Error("503 Service Unavailable"))
        .mockRejectedValueOnce(new Error("503 Service Unavailable"))
        .mockResolvedValueOnce(createMockResponse({ json: { id: "pin_123" } }));

      const promise = publishToPinterest(mockContent, mockAccount);

      // First retry delay: 1500 * 1 = 1500
      await vi.advanceTimersByTimeAsync(1500);
      // Second retry delay: 1500 * 2 = 3000
      await vi.advanceTimersByTimeAsync(3000);

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.postId).toBe("pin_123");
      expect(mockFetch).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it("should exhaust all retries and return failure", async () => {
      vi.useFakeTimers();
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValue(new Error("503 Service Unavailable"));

      const promise = publishToPinterest(mockContent, mockAccount);

      // Attempt 1: fails → retry delay 1500ms
      // Attempt 2: fails → retry delay 3000ms
      // Attempt 3: fails → no retry, return error
      await vi.advanceTimersByTimeAsync(1500);
      await vi.advanceTimersByTimeAsync(3000);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain("503");
      expect(mockFetch).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it("should not retry on non-transient errors (4xx)", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 400,
          json: { error_message: "Bad request" },
        }),
      );

      const result = await publishToPinterest(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should not retry on network error without transient keywords", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValueOnce(new Error("DNS resolution failed"));

      const result = await publishToPinterest(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("network errors", () => {
    it("should return error on network failure", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const result = await publishToPinterest(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network failure");
    });

    it("should return generic error for non-Error thrown values", async () => {
      const mockFetch = vi.mocked(fetchWithTimeout);
      mockFetch.mockRejectedValueOnce("String error");

      const result = await publishToPinterest(mockContent, mockAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown Pinterest publish error");
    });
  });
});

// ── getPinterestBoards ─────────────────────────────────────────────────────

describe("getPinterestBoards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return boards on success", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        json: {
          items: [
            { id: "board_1", name: "Board One" },
            { id: "board_2", name: "Board Two" },
          ],
        },
      }),
    );

    const result = await getPinterestBoards("valid-token");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "board_1", name: "Board One" });
    expect(result[1]).toEqual({ id: "board_2", name: "Board Two" });
  });

  it("should return empty array on 401 error", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ ok: false, status: 401, json: {} }));

    const result = await getPinterestBoards("bad-token");

    expect(result).toStrictEqual([]);
  });

  it("should return empty array on 403 error", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ ok: false, status: 403, json: {} }));

    const result = await getPinterestBoards("forbidden-token");

    expect(result).toStrictEqual([]);
  });

  it("should return empty array on network error (catch silent)", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await getPinterestBoards("token");

    expect(result).toStrictEqual([]);
  });
});

// ── createPinterestBoard ───────────────────────────────────────────────────

describe("createPinterestBoard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should create a board successfully", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "new_board_42" } }));

    const result = await createPinterestBoard("My Board", "A description", "token");

    expect(result.success).toBe(true);
    expect(result.boardId).toBe("new_board_42");
    expect(result.error).toBeUndefined();
  });

  it("should handle empty name", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "empty_name_board" } }));

    const result = await createPinterestBoard("", "desc", "token");

    expect(result.success).toBe(true);
    expect(result.boardId).toBe("empty_name_board");
  });

  it("should handle very long name", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "long_name_board" } }));

    const longName = "x".repeat(500);
    const result = await createPinterestBoard(longName, "desc", "token");

    expect(result.success).toBe(true);
    expect(result.boardId).toBe("long_name_board");

    // Verify the long name was sent in the request body
    const callBody = JSON.parse((mockFetch.mock.calls[0]![1] as RequestInit).body as string);
    expect(callBody.name).toBe(longName);
  });

  it("should return error when response is not ok", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ ok: false, status: 400, json: {} }));

    const result = await createPinterestBoard("Board", "desc", "token");

    expect(result.success).toBe(false);
    expect(result.error).toContain("400");
  });

  it("should return error on network failure", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await createPinterestBoard("Board", "desc", "token");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
  });

  it("should handle non-Error thrown values gracefully", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockRejectedValueOnce("String rejection");

    const result = await createPinterestBoard("Board", "desc", "token");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Unknown error");
  });
});

// ── getPinterestProfile ────────────────────────────────────────────────────

describe("getPinterestProfile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return profile on success", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        json: {
          id: "user_1",
          username: "pintester",
          full_name: "Pin Tester",
          boards_count: 12,
        },
      }),
    );

    const result = await getPinterestProfile("token");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("user_1");
    expect(result!.username).toBe("pintester");
    expect(result!.full_name).toBe("Pin Tester");
    expect(result!.boards_count).toBe(12);
  });

  it("should fall back full_name to username when full_name is missing", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        json: { id: "user_2", username: "no_fullname" },
      }),
    );

    const result = await getPinterestProfile("token");

    expect(result!.full_name).toBe("no_fullname");
  });

  it("should default boards_count to 0 when missing", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        json: { id: "user_3", username: "u", full_name: "User" },
      }),
    );

    const result = await getPinterestProfile("token");

    expect(result!.boards_count).toBe(0);
  });

  it("should return null when response is not ok", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ ok: false, status: 401, json: {} }));

    const result = await getPinterestProfile("bad-token");

    expect(result).toBeNull();
  });

  it("should return null on network error", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await getPinterestProfile("token");

    expect(result).toBeNull();
  });
});
