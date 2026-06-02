/**
 * Tests for Token Refresh Trigger
 *
 * Verifies:
 * - runTokenRefreshBatch() finds expiring tokens via repository
 * - runTokenRefreshBatch() uses getValidAccessToken for each account
 * - runTokenRefreshBatch() returns correct { refreshed, failed } counts
 * - runTokenRefresh() handles individual account refresh
 * - Error handling: one failure doesn't stop others
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/services/tokens";
import { runTokenRefresh, runTokenRefreshBatch } from "@/triggers/token-refresh.trigger";

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

// ── Tests ──────────────────────────────────────────────────────────────────

describe("runTokenRefreshBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should find expiring tokens and refresh them via getValidAccessToken", async () => {
    const accounts = [makeMockAccount({ id: "ca-1" }), makeMockAccount({ id: "ca-2" })];

    mockConnectedAccountRepo.findExpiringBefore.mockResolvedValue(accounts);
    (getValidAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue("valid-token");

    const result = await runTokenRefreshBatch();

    // Verify repository was queried with a date ~24h from now
    expect(mockConnectedAccountRepo.findExpiringBefore).toHaveBeenCalledWith(expect.any(Date));

    // Verify getValidAccessToken was called for each account
    expect(getValidAccessToken).toHaveBeenCalledTimes(2);
    expect(getValidAccessToken).toHaveBeenCalledWith("ca-1");
    expect(getValidAccessToken).toHaveBeenCalledWith("ca-2");

    expect(result).toEqual({ refreshed: 2, failed: 0 });
  });

  it("should return refreshed=0 when no tokens are expiring", async () => {
    mockConnectedAccountRepo.findExpiringBefore.mockResolvedValue([]);

    const result = await runTokenRefreshBatch();

    expect(getValidAccessToken).not.toHaveBeenCalled();
    expect(result).toEqual({ refreshed: 0, failed: 0 });
  });

  it("should count failures when getValidAccessToken returns null", async () => {
    const accounts = [makeMockAccount({ id: "ca-1" }), makeMockAccount({ id: "ca-2" })];

    mockConnectedAccountRepo.findExpiringBefore.mockResolvedValue(accounts);
    (getValidAccessToken as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce("valid-token")
      .mockResolvedValueOnce(null);

    const result = await runTokenRefreshBatch();

    expect(result).toEqual({ refreshed: 1, failed: 1 });
  });

  it("should handle exceptions gracefully without stopping the batch", async () => {
    const accounts = [
      makeMockAccount({ id: "ca-1" }),
      makeMockAccount({ id: "ca-2" }),
      makeMockAccount({ id: "ca-3" }),
    ];

    mockConnectedAccountRepo.findExpiringBefore.mockResolvedValue(accounts);
    (getValidAccessToken as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce("token-1")
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce("token-3");

    const result = await runTokenRefreshBatch();

    expect(getValidAccessToken).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ refreshed: 2, failed: 1 });
  });

  it("should handle all failures gracefully", async () => {
    const accounts = [makeMockAccount({ id: "ca-1" }), makeMockAccount({ id: "ca-2" })];

    mockConnectedAccountRepo.findExpiringBefore.mockResolvedValue(accounts);
    (getValidAccessToken as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Auth error"));

    const result = await runTokenRefreshBatch();

    expect(result).toEqual({ refreshed: 0, failed: 2 });
  });
});

describe("runTokenRefresh (single account)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw when account is not found", async () => {
    (prisma.connectedAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );

    await expect(runTokenRefresh("nonexistent")).rejects.toThrow(
      "Connected account not found: nonexistent",
    );
  });

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
  });
});
