import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishToFacebook } from "../../publishers/facebook";

vi.mock("@/lib/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
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

describe("publishToFacebook", () => {
  const mockContent = {
    textContent: "Hello Facebook",
    mediaUrls: [] as string[],
    hashtags: ["test", "social"],
  };
  const mockAccount = {
    accountId: "page_123",
    accessToken: "fb-token",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should publish successfully with media URL", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "fb_123" } }));

    const result = await publishToFacebook(
      { ...mockContent, mediaUrls: ["https://example.com/image.jpg"] },
      mockAccount,
    );

    expect(result.success).toBe(true);
    expect(result.postId).toBe("fb_123");

    // Verify the request body includes the link field
    const callArg = mockFetch.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callArg.body as string);
    expect(body.link).toBe("https://example.com/image.jpg");
    expect(body.message).toContain("Hello Facebook");
  });

  it("should publish successfully without media URL", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "fb_456" } }));

    const result = await publishToFacebook(mockContent, mockAccount);

    expect(result.success).toBe(true);
    expect(result.postId).toBe("fb_456");

    // Verify no link field in the body
    const callArg = mockFetch.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callArg.body as string);
    expect(body.link).toBeUndefined();
  });

  it("should append hashtags to the message", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "fb_789" } }));

    await publishToFacebook(mockContent, mockAccount);

    const callArg = mockFetch.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callArg.body as string);
    expect(body.message).toContain("#test #social");
  });

  it("should return error when API returns error object", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        json: { error: { message: "Invalid access token" } },
      }),
    );

    const result = await publishToFacebook(mockContent, mockAccount);

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Facebook API returned an error. Please check your post and try again.",
    );
  });

  it("should return error on network failure", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await publishToFacebook(mockContent, mockAccount);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network failure");
  });

  it("should return generic error for non-Error thrown values", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockRejectedValueOnce("String error");

    const result = await publishToFacebook(mockContent, mockAccount);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Unknown error");
  });

  it("should include access_token as Authorization header", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "fb_123" } }));

    await publishToFacebook(mockContent, mockAccount);

    const headers = (mockFetch.mock.calls[0]![1] as any).headers;
    expect(headers).toHaveProperty("Authorization", "Bearer fb-token");
  });

  it("should POST to the correct endpoint", async () => {
    const mockFetch = vi.mocked(fetchWithTimeout);
    mockFetch.mockResolvedValueOnce(createMockResponse({ json: { id: "fb_123" } }));

    await publishToFacebook(mockContent, mockAccount);

    const callUrl = mockFetch.mock.calls[0]![0];
    expect(callUrl).toContain("graph.facebook.com");
    expect(callUrl).toContain("page_123");
    expect(callUrl).toContain("/feed");
  });
});
