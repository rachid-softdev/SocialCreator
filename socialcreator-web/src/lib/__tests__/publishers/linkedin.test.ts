import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishToLinkedIn } from "../../publishers/linkedin";

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

describe("publishToLinkedIn", () => {
  const mockContent = {
    textContent: "Excited to share our new feature!",
    mediaUrls: [] as string[],
    hashtags: ["linkedin", "b2b"],
  };
  const mockAccount = {
    accountId: "person_abc",
    accessToken: "li-token",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should publish successfully", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "li_123" } }));

    const result = await publishToLinkedIn(mockContent, mockAccount);

    expect(result.success).toBe(true);
    expect(result.postId).toBe("li_123");
  });

  it("should return error when API returns message field", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        ok: false,
        status: 404,
        json: { message: "Member not found" },
      }),
    );

    const result = await publishToLinkedIn(mockContent, mockAccount);

    expect(result.success).toBe(false);
    expect(result.error).toBe("LinkedIn API error: 404");
  });

  it("should return error when API returns error field", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        ok: false,
        status: 401,
        json: { error: "INVALID_TOKEN" },
      }),
    );

    const result = await publishToLinkedIn(mockContent, mockAccount);

    expect(result.success).toBe(false);
    expect(result.error).toBe("LinkedIn API error: 401");
  });

  it("should fall back to HTTP status when JSON body is empty", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        ok: false,
        status: 401,
        json: {},
      }),
    );

    const result = await publishToLinkedIn(mockContent, mockAccount);

    expect(result.success).toBe(false);
    expect(result.error).toBe("LinkedIn API error: 401");
  });

  it("should return error on network failure", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await publishToLinkedIn(mockContent, mockAccount);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network failure");
  });

  it("should return generic error for non-Error thrown values", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockRejectedValueOnce("String error");

    const result = await publishToLinkedIn(mockContent, mockAccount);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Unknown error");
  });

  it("should include correct headers in the request", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "li_123" } }));

    await publishToLinkedIn(mockContent, mockAccount);

    const callArg = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = callArg.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer li-token");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["LinkedIn-Version"]).toBe("202402");
    expect(headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
  });

  it("should POST to the correct endpoint", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "li_123" } }));

    await publishToLinkedIn(mockContent, mockAccount);

    const callUrl = mockFetch.mock.calls[0][0];
    expect(callUrl).toBe("https://api.linkedin.com/rest/posts");
  });

  it("should include hashtags in commentary", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "li_123" } }));

    await publishToLinkedIn(mockContent, mockAccount);

    const callArg = mockFetch.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callArg.body as string);
    expect(body.commentary).toContain("#linkedin #b2b");
  });
});
