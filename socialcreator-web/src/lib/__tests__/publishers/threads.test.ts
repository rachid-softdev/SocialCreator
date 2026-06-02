import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishToThreads } from "../../publishers/threads";

vi.mock("@/lib/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from "@/lib/fetch-timeout";

function createMockResponse(
  overrides: {
    ok?: boolean;
    status?: number;
    json?: unknown;
    headers?: Record<string, string>;
  } = {},
): Response {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    json: vi.fn().mockResolvedValue(overrides.json ?? {}),
    text: vi.fn().mockResolvedValue(""),
    blob: vi.fn(),
    headers: {
      get: vi.fn((name: string) => {
        const h = overrides.headers ?? {};
        return h[name] ?? null;
      }),
    },
  } as unknown as Response;
}

describe("publishToThreads", () => {
  const mockContent = {
    textContent: "Hello Threads!",
    mediaUrls: [] as string[],
    hashtags: ["threads", "test"],
  };
  const mockAccount = {
    accountId: "me",
    accessToken: "threads-token",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should publish successfully", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "threads_123" } }));

    const result = await publishToThreads(mockContent, mockAccount);

    expect(result.success).toBe(true);
    expect(result.postId).toBe("threads_123");
  });

  it("should return error when API returns error object", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        json: { error: { message: "Invalid token" } },
      }),
    );

    const result = await publishToThreads(mockContent, mockAccount);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Threads API error: 200");
  });

  it("should truncate text content to 500 characters", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "threads_123" } }));

    const longText = "x".repeat(600);
    await publishToThreads({ ...mockContent, textContent: longText }, mockAccount);

    const callArg = mockFetch.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callArg.body as string);
    expect(body.message.length).toBe(500);
    expect(body.message).toBe("x".repeat(500));
  });

  it("should return error on network failure", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await publishToThreads(mockContent, mockAccount);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network failure");
  });

  it("should return generic error for non-Error thrown values", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockRejectedValueOnce("String error");

    const result = await publishToThreads(mockContent, mockAccount);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Unknown error");
  });

  it("should POST to the correct endpoint", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "threads_123" } }));

    await publishToThreads(mockContent, mockAccount);

    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain("graph.facebook.com");
    expect(callUrl).toContain("/threads");
  });

  it("should include access_token as Authorization header", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "threads_123" } }));

    await publishToThreads(mockContent, mockAccount);

    const headers = (mockFetch.mock.calls[0][1] as any).headers;
    expect(headers).toHaveProperty("Authorization", "Bearer threads-token");
  });
});
