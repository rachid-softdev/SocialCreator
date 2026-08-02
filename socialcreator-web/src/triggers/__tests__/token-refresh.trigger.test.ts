/**
 * Comprehensive tests for Token Refresh Trigger
 *
 * Covers:
 * - runTokenRefresh() — single-account refresh for all platforms (INSTAGRAM, FACEBOOK,
 *   YOUTUBE, LINKEDIN), error handling, and edge cases
 * - runTokenRefreshBatch() — batch refresh with success, partial failure, empty results,
 *   and resilience when individual accounts throw
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock prisma (used by runTokenRefresh, the single-account variant)
vi.mock("@/lib/prisma", () => ({
  prisma: {
    connectedAccount: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock crypto
vi.mock("@/lib/crypto", () => ({
  decryptToken: vi.fn((token: string) => `decrypted-${token}`),
  encryptToken: vi.fn((token: string) => `encrypted-${token}`),
}));

// Mock fetch-timeout (used by refreshOAuthToken)
vi.mock("@/lib/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock repositories (used by runTokenRefreshBatch)
const mockConnectedAccountRepo = {
  findById: vi.fn(),
  findByProfileId: vi.fn(),
  findByProfileAndPlatform: vi.fn(),
  findExpiringBefore: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => ({
    connectedAccount: mockConnectedAccountRepo,
  })),
}));

// Mock getValidAccessToken (used by runTokenRefreshBatch)
vi.mock("@/lib/services/tokens", () => ({
  getValidAccessToken: vi.fn(),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { decryptToken, encryptToken } from "@/lib/crypto";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/services/tokens";
import { runTokenRefresh, runTokenRefreshBatch } from "@/triggers/token-refresh.trigger";

// ── Environment Setup ──────────────────────────────────────────────────────

beforeAll(() => {
  process.env.META_CLIENT_ID = "meta-client-id";
  process.env.META_CLIENT_SECRET = "meta-client-secret";
  process.env.GOOGLE_CLIENT_ID = "google-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
  process.env.LINKEDIN_CLIENT_ID = "linkedin-client-id";
  process.env.LINKEDIN_CLIENT_SECRET = "linkedin-client-secret";
});

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "ca-1",
    platform: "INSTAGRAM",
    accessToken: "encrypted-access-token",
    refreshToken: "encrypted-refresh-token",
    expiresAt: new Date("2025-06-01"),
    isActive: true,
    profileId: "profile-1",
    accountId: "ext-123",
    accountName: "Test Account",
    accountAvatarUrl: null,
    tokenType: null,
    scope: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeMockFetchResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

// ── Tests: runTokenRefresh ──────────────────────────────────────────────────

describe("runTokenRefresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // ── Error / edge cases ─────────────────────────────────────────────────

  // Scenario 4: Account not found → throws
  it("should throw when account is not found", async () => {
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );

    await expect(runTokenRefresh("nonexistent")).rejects.toThrow(
      "Connected account not found: nonexistent",
    );

    expect(prisma.connectedAccount.update).not.toHaveBeenCalled();
  });

  // Scenario 5: No refreshToken → returns { refreshed: false }
  it("should return refreshed=false when account has no refreshToken", async () => {
    const account = makeMockAccount({ refreshToken: null });
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      account,
    );

    const result = await runTokenRefresh("ca-1");

    expect(result).toEqual({
      accountId: "ca-1",
      platform: "INSTAGRAM",
      refreshed: false,
    });
    // Should not proceed to decrypt or fetch
    expect(decryptToken).not.toHaveBeenCalled();
    expect(fetchWithTimeout).not.toHaveBeenCalled();
    expect(prisma.connectedAccount.update).not.toHaveBeenCalled();
  });

  // Scenario 6: Token refresh returns null (fetch not ok) → returns { refreshed: false }
  it("should return refreshed=false when fetch response is not ok", async () => {
    const account = makeMockAccount();
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      account,
    );

    const mockResponse = makeMockFetchResponse({ ok: false, status: 400 });
    (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await runTokenRefresh("ca-1");

    expect(result).toEqual({
      accountId: "ca-1",
      platform: "INSTAGRAM",
      refreshed: false,
    });
    // Should not persist anything
    expect(prisma.connectedAccount.update).not.toHaveBeenCalled();
  });

  // Scenario 7: Unsupported platform (e.g., "X") → returns { refreshed: false }
  it("should return refreshed=false for unsupported platform", async () => {
    const account = makeMockAccount({ platform: "X" });
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      account,
    );

    const result = await runTokenRefresh("ca-1");

    expect(result).toEqual({
      accountId: "ca-1",
      platform: "X",
      refreshed: false,
    });
    // Token was decrypted but the default case in refreshOAuthToken returns null
    expect(decryptToken).toHaveBeenCalledWith("encrypted-refresh-token");
    // No fetch call was made (switch default returns null immediately)
    expect(fetchWithTimeout).not.toHaveBeenCalled();
    expect(prisma.connectedAccount.update).not.toHaveBeenCalled();
  });

  // ── Platform-specific success ──────────────────────────────────────────

  // Scenario 1: Successfully refreshes a Meta (INSTAGRAM) token
  it("should refresh INSTAGRAM token via fb_exchange_token grant", async () => {
    const now = new Date("2025-06-01T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const account = makeMockAccount();
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      account,
    );

    const mockResponse = makeMockFetchResponse({
      json: vi.fn().mockResolvedValue({
        access_token: "new-meta-token",
        expires_in: 5184000, // 60 days in seconds
      }),
    });
    (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await runTokenRefresh("ca-1");

    // Verify fetch URL points to Meta's graph API with fb_exchange_token
    const fetchUrl = (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as string;
    expect(fetchUrl).toContain("graph.facebook.com");

    const parsedUrl = new URL(fetchUrl);
    expect(parsedUrl.searchParams.get("grant_type")).toBe("fb_exchange_token");
    expect(parsedUrl.searchParams.get("fb_exchange_token")).toBe(
      "decrypted-encrypted-refresh-token",
    );
    expect(parsedUrl.searchParams.get("client_id")).toBe("meta-client-id");
    expect(parsedUrl.searchParams.get("client_secret")).toBe("meta-client-secret");

    // Verify tokens were encrypted before persisting
    expect(decryptToken).toHaveBeenCalledWith("encrypted-refresh-token");
    expect(encryptToken).toHaveBeenCalledWith("new-meta-token");
    // Meta does not return a new refresh_token, so encryptToken is called exactly once
    expect(encryptToken).toHaveBeenCalledTimes(1);

    // Verify the persistence call
    const expectedExpiresAt = new Date(now.getTime() + 5184000 * 1000);
    expect(prisma.connectedAccount.update).toHaveBeenCalledWith({
      where: { id: "ca-1" },
      data: {
        accessToken: "encrypted-new-meta-token",
        refreshToken: account.refreshToken, // original refreshToken preserved
        expiresAt: expectedExpiresAt,
      },
    });

    expect(result).toEqual({
      accountId: "ca-1",
      platform: "INSTAGRAM",
      refreshed: true,
      expiresAt: expectedExpiresAt.toISOString(),
    });

    vi.useRealTimers();
  });

  // Scenario 1b: Same flow for FACEBOOK (shares the INSTAGRAM case in switch)
  it("should refresh FACEBOOK token via fb_exchange_token grant", async () => {
    const now = new Date("2025-06-01T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const account = makeMockAccount({ platform: "FACEBOOK" });
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      account,
    );

    const mockResponse = makeMockFetchResponse({
      json: vi.fn().mockResolvedValue({
        access_token: "new-fb-token",
        expires_in: 5184000,
      }),
    });
    (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await runTokenRefresh("ca-1");

    expect(result.refreshed).toBe(true);
    expect(result.platform).toBe("FACEBOOK");

    const fetchUrl = (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as string;
    expect(fetchUrl).toContain("graph.facebook.com");

    expect(prisma.connectedAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ca-1" },
        data: expect.objectContaining({
          accessToken: "encrypted-new-fb-token",
        }),
      }),
    );

    vi.useRealTimers();
  });

  // Scenario 2: Successfully refreshes a YOUTUBE token
  it("should refresh YOUTUBE token via standard refresh_token grant", async () => {
    const now = new Date("2025-06-01T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const account = makeMockAccount({ platform: "YOUTUBE" });
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      account,
    );

    const mockResponse = makeMockFetchResponse({
      json: vi.fn().mockResolvedValue({
        access_token: "new-yt-token",
        expires_in: 3600,
      }),
    });
    (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await runTokenRefresh("ca-1");

    // Verify URL is the Google OAuth endpoint
    const fetchCalls = (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mock
      .calls as Array<[string, Record<string, unknown>]>;
    const [fetchUrl, fetchOptions] = fetchCalls[0]!;

    expect(fetchUrl).toBe("https://oauth2.googleapis.com/token");

    // Verify request method and headers
    expect(fetchOptions).toMatchObject({
      method: "POST",
      timeout: 10000,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    // Verify POST body content
    const body = fetchOptions.body as URLSearchParams;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("decrypted-encrypted-refresh-token");
    expect(body.get("client_id")).toBe(process.env.GOOGLE_CLIENT_ID);
    expect(body.get("client_secret")).toBe(process.env.GOOGLE_CLIENT_SECRET);

    // Verify token was encrypted
    expect(encryptToken).toHaveBeenCalledWith("new-yt-token");

    // Verify persistence
    const expectedExpiresAt = new Date(now.getTime() + 3600 * 1000);
    expect(prisma.connectedAccount.update).toHaveBeenCalledWith({
      where: { id: "ca-1" },
      data: {
        accessToken: "encrypted-new-yt-token",
        refreshToken: account.refreshToken,
        expiresAt: expectedExpiresAt,
      },
    });

    expect(result).toEqual({
      accountId: "ca-1",
      platform: "YOUTUBE",
      refreshed: true,
      expiresAt: expectedExpiresAt.toISOString(),
    });

    vi.useRealTimers();
  });

  // Scenario 3: Successfully refreshes a LINKEDIN token
  it("should refresh LINKEDIN token via standard refresh_token grant", async () => {
    const now = new Date("2025-06-01T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const account = makeMockAccount({ platform: "LINKEDIN" });
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      account,
    );

    const mockResponse = makeMockFetchResponse({
      json: vi.fn().mockResolvedValue({
        access_token: "new-li-token",
        expires_in: 86400,
      }),
    });
    (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await runTokenRefresh("ca-1");

    // Verify URL is the LinkedIn OAuth endpoint
    const fetchCalls = (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mock
      .calls as Array<[string, Record<string, unknown>]>;
    const [fetchUrl, fetchOptions] = fetchCalls[0]!;

    expect(fetchUrl).toBe("https://www.linkedin.com/oauth/v2/accessToken");

    // Verify request method and headers
    expect(fetchOptions).toMatchObject({
      method: "POST",
      timeout: 10000,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    // Verify POST body content
    const body = fetchOptions.body as URLSearchParams;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("decrypted-encrypted-refresh-token");
    expect(body.get("client_id")).toBe(process.env.LINKEDIN_CLIENT_ID);
    expect(body.get("client_secret")).toBe(process.env.LINKEDIN_CLIENT_SECRET);

    // Verify token was encrypted
    expect(encryptToken).toHaveBeenCalledWith("new-li-token");

    // Verify persistence
    const expectedExpiresAt = new Date(now.getTime() + 86400 * 1000);
    expect(prisma.connectedAccount.update).toHaveBeenCalledWith({
      where: { id: "ca-1" },
      data: {
        accessToken: "encrypted-new-li-token",
        refreshToken: account.refreshToken,
        expiresAt: expectedExpiresAt,
      },
    });

    expect(result).toEqual({
      accountId: "ca-1",
      platform: "LINKEDIN",
      refreshed: true,
      expiresAt: expectedExpiresAt.toISOString(),
    });

    vi.useRealTimers();
  });

  // ── Response edge cases ────────────────────────────────────────────────

  it("should use default expires_in (5184000) when Meta response omits expires_in", async () => {
    const now = new Date("2025-06-01T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const account = makeMockAccount();
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      account,
    );

    const mockResponse = makeMockFetchResponse({
      json: vi.fn().mockResolvedValue({ access_token: "new-token" }), // no expires_in
    });
    (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await runTokenRefresh("ca-1");

    const expectedExpiresAt = new Date(now.getTime() + 5184000 * 1000);
    expect(prisma.connectedAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expiresAt: expectedExpiresAt,
        }),
      }),
    );
    expect(result.expiresAt).toBe(expectedExpiresAt.toISOString());

    vi.useRealTimers();
  });

  it("should handle non-array response body (runTokenRefresh still returns refreshed=true)", async () => {
    // This test ensures the json() call works even with unexpected response shapes
    // The important thing is access_token is present
    const account = makeMockAccount();
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      account,
    );

    const mockResponse = makeMockFetchResponse({
      ok: true,
      json: vi.fn().mockResolvedValue({ access_token: "new-token", extra_field: "unused" }),
    });
    (fetchWithTimeout as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await runTokenRefresh("ca-1");

    expect(result.refreshed).toBe(true);
    expect(prisma.connectedAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessToken: "encrypted-new-token",
        }),
      }),
    );
  });
});

// ── Tests: runTokenRefreshBatch ─────────────────────────────────────────────

describe("runTokenRefreshBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Scenario 8: All accounts refresh successfully
  it("should refresh all expiring accounts and return refreshed=2, failed=0", async () => {
    const accounts = [makeMockAccount({ id: "ca-1" }), makeMockAccount({ id: "ca-2" })];

    mockConnectedAccountRepo.findExpiringBefore.mockResolvedValue(accounts);
    (getValidAccessToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("valid-token");

    const result = await runTokenRefreshBatch();

    // Verify repository was queried with a date ~24h from now
    expect(mockConnectedAccountRepo.findExpiringBefore).toHaveBeenCalledWith(expect.any(Date));

    // Verify getValidAccessToken was called for each account
    expect(getValidAccessToken).toHaveBeenCalledTimes(2);
    expect(getValidAccessToken).toHaveBeenCalledWith("ca-1");
    expect(getValidAccessToken).toHaveBeenCalledWith("ca-2");

    expect(result).toEqual({ refreshed: 2, failed: 0 });
  });

  // Scenario 10: No expiring accounts
  it("should return refreshed=0 when no tokens are expiring", async () => {
    mockConnectedAccountRepo.findExpiringBefore.mockResolvedValue([]);

    const result = await runTokenRefreshBatch();

    expect(getValidAccessToken).not.toHaveBeenCalled();
    expect(result).toEqual({ refreshed: 0, failed: 0 });
  });

  // Scenario 9: Mixed success/failure
  it("should count failures when getValidAccessToken returns null", async () => {
    const accounts = [makeMockAccount({ id: "ca-1" }), makeMockAccount({ id: "ca-2" })];

    mockConnectedAccountRepo.findExpiringBefore.mockResolvedValue(accounts);
    (getValidAccessToken as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce("valid-token")
      .mockResolvedValueOnce(null);

    const result = await runTokenRefreshBatch();

    expect(result).toEqual({ refreshed: 1, failed: 1 });
  });

  // Scenario 11: One account throws during refresh → continues processing remaining accounts
  it("should continue processing remaining accounts when one throws", async () => {
    const accounts = [
      makeMockAccount({ id: "ca-1" }),
      makeMockAccount({ id: "ca-2" }),
      makeMockAccount({ id: "ca-3" }),
    ];

    mockConnectedAccountRepo.findExpiringBefore.mockResolvedValue(accounts);
    (getValidAccessToken as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce("token-1")
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce("token-3");

    const result = await runTokenRefreshBatch();

    // All three accounts were processed
    expect(getValidAccessToken).toHaveBeenCalledTimes(3);
    expect(getValidAccessToken).toHaveBeenCalledWith("ca-1");
    expect(getValidAccessToken).toHaveBeenCalledWith("ca-2");
    expect(getValidAccessToken).toHaveBeenCalledWith("ca-3");

    expect(result).toEqual({ refreshed: 2, failed: 1 });
  });

  it("should handle all accounts throwing exceptions", async () => {
    const accounts = [makeMockAccount({ id: "ca-1" }), makeMockAccount({ id: "ca-2" })];

    mockConnectedAccountRepo.findExpiringBefore.mockResolvedValue(accounts);
    (getValidAccessToken as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Auth error"),
    );

    const result = await runTokenRefreshBatch();

    expect(getValidAccessToken).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ refreshed: 0, failed: 2 });
  });

  it("should handle mix of null returns and exceptions", async () => {
    const accounts = [
      makeMockAccount({ id: "ca-1" }),
      makeMockAccount({ id: "ca-2" }),
      makeMockAccount({ id: "ca-3" }),
      makeMockAccount({ id: "ca-4" }),
    ];

    mockConnectedAccountRepo.findExpiringBefore.mockResolvedValue(accounts);
    (getValidAccessToken as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce("token-1") // success
      .mockResolvedValueOnce(null) // null = failure
      .mockRejectedValueOnce(new Error("Timeout")) // exception = failure
      .mockResolvedValueOnce("token-4"); // success

    const result = await runTokenRefreshBatch();

    expect(result).toEqual({ refreshed: 2, failed: 2 });
  });
});
