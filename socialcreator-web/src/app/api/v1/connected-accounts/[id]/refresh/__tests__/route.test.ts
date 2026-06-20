/**
 * Unit tests for POST /api/v1/connected-accounts/[id]/refresh
 *
 * Verifies:
 * - 200 on successful token refresh with account data
 * - 404 when account not found
 * - 401 when profile not found
 * - 401 when profile not owned by user
 * - 400 when getValidAccessToken returns null
 *
 * Uses mocked dependencies — no real database needed.
 * Follows the exact mock pattern from src/app/api/v1/__tests__/routes.test.ts.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — created before vi.mock() calls since vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockGetValidAccessToken } = vi.hoisted(() => ({
  mockGetValidAccessToken: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit-redis", () => ({ withRateLimit: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock withApiMiddleware to be a pass-through for handler tests.
// Auth/rate-limit behavior is tested separately in api-middleware.integration.test.ts.
vi.mock("@/lib/api-middleware", () => {
  const withApiMiddleware = (handler: (ctx: any, params?: any) => Promise<Response>) => {
    return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
      const resolvedParams = context?.params ? await context.params : {};
      return handler(
        { userId: "user-abc-123", request, apiVersion: "v1", params: resolvedParams },
        resolvedParams,
      );
    };
  };
  return { withApiMiddleware };
});

// Repository mocks
const mockRepos = {
  profile: {
    findById: vi.fn(),
  },
  connectedAccount: {
    findById: vi.fn(),
  },
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => mockRepos),
}));

// Token service mock — uses the hoisted variable
vi.mock("@/lib/services/tokens", () => ({
  getValidAccessToken: mockGetValidAccessToken,
}));

// ---------------------------------------------------------------------------
// Import route handler
// ---------------------------------------------------------------------------

import { POST } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  path: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> },
): NextRequest {
  const url = `http://localhost:3000${path}`;
  const body = options?.body !== undefined ? JSON.stringify(options.body) : undefined;
  return new NextRequest(url, {
    method: options?.method ?? "GET",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body,
  });
}

function createParams(params: Record<string, string>): { params: Promise<Record<string, string>> } {
  return { params: Promise.resolve(params) };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "p-1",
    userId: "user-abc-123",
    name: "Test Profile",
    ...overrides,
  };
}

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "ca-1",
    profileId: "p-1",
    platform: "X",
    accessToken: "decrypted-access-token",
    refreshToken: "decrypted-refresh-token",
    expiresAt: new Date("2025-12-31T23:59:59Z"),
    accountName: "Test User",
    accountId: "x-user-123",
    accountAvatarUrl: "https://example.com/avatar.jpg",
    isActive: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/connected-accounts/[id]/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path ────────────────────────────────────────────

  it("should refresh token and return 200 with updated account", async () => {
    const profile = makeProfile();
    const account = makeAccount();
    const updatedAccount = makeAccount({ accessToken: "refreshed-token-value" });

    mockRepos.connectedAccount.findById
      .mockResolvedValueOnce(account)
      .mockResolvedValueOnce(updatedAccount);
    mockRepos.profile.findById.mockResolvedValue(profile);
    mockGetValidAccessToken.mockResolvedValue("refreshed-token-value");

    const res = await POST(
      createRequest("/api/v1/connected-accounts/ca-1/refresh", { method: "POST" }),
      createParams({ id: "ca-1" }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.account).toBeDefined();
    expect(data.account.id).toBe("ca-1");
    expect(data.account.accessToken).toBe("refreshed-token-value");
  });

  it("should include Cache-Control and X-API-Version headers on success", async () => {
    const account = makeAccount();
    mockRepos.connectedAccount.findById.mockResolvedValue(account);
    mockRepos.profile.findById.mockResolvedValue(makeProfile());
    mockGetValidAccessToken.mockResolvedValue("refreshed-token");

    const res = await POST(
      createRequest("/api/v1/connected-accounts/ca-1/refresh", { method: "POST" }),
      createParams({ id: "ca-1" }),
    );

    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });

  it("should call getValidAccessToken with the correct account id", async () => {
    const account = makeAccount();
    mockRepos.connectedAccount.findById.mockResolvedValue(account);
    mockRepos.profile.findById.mockResolvedValue(makeProfile());
    mockGetValidAccessToken.mockResolvedValue("refreshed-token");

    await POST(
      createRequest("/api/v1/connected-accounts/ca-1/refresh", { method: "POST" }),
      createParams({ id: "ca-1" }),
    );

    expect(mockGetValidAccessToken).toHaveBeenCalledWith("ca-1");
  });

  it("should re-fetch the account after successful token refresh", async () => {
    const account = makeAccount();
    const profile = makeProfile();

    mockRepos.connectedAccount.findById
      .mockResolvedValueOnce(account)
      .mockResolvedValueOnce({ ...account, accessToken: "new-token" });
    mockRepos.profile.findById.mockResolvedValue(profile);
    mockGetValidAccessToken.mockResolvedValue("new-token");

    await POST(
      createRequest("/api/v1/connected-accounts/ca-1/refresh", { method: "POST" }),
      createParams({ id: "ca-1" }),
    );

    // findById should be called twice: once to fetch the account, once after refresh
    expect(mockRepos.connectedAccount.findById).toHaveBeenCalledTimes(2);
    expect(mockRepos.connectedAccount.findById).toHaveBeenCalledWith("ca-1");
  });

  // ── Error: account not found ──────────────────────────────

  it("should return 404 when account is not found", async () => {
    mockRepos.connectedAccount.findById.mockResolvedValue(null);

    const res = await POST(
      createRequest("/api/v1/connected-accounts/ca-nonexistent/refresh", { method: "POST" }),
      createParams({ id: "ca-nonexistent" }),
    );

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe("NOT_FOUND");
    expect(data.error).toContain("Connected account");
  });

  it("should not query profile or tokens when account is not found", async () => {
    mockRepos.connectedAccount.findById.mockResolvedValue(null);

    await POST(
      createRequest("/api/v1/connected-accounts/ca-nonexistent/refresh", { method: "POST" }),
      createParams({ id: "ca-nonexistent" }),
    );

    expect(mockRepos.profile.findById).not.toHaveBeenCalled();
    expect(mockGetValidAccessToken).not.toHaveBeenCalled();
  });

  // ── Error: profile not found ──────────────────────────────

  it("should return 401 when account's profile is not found", async () => {
    mockRepos.connectedAccount.findById.mockResolvedValue(makeAccount());
    mockRepos.profile.findById.mockResolvedValue(null);

    const res = await POST(
      createRequest("/api/v1/connected-accounts/ca-1/refresh", { method: "POST" }),
      createParams({ id: "ca-1" }),
    );

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe("UNAUTHORIZED");
    expect(data.error).toBe("Unauthorized");
  });

  it("should not attempt token refresh when profile is not found", async () => {
    mockRepos.connectedAccount.findById.mockResolvedValue(makeAccount());
    mockRepos.profile.findById.mockResolvedValue(null);

    await POST(
      createRequest("/api/v1/connected-accounts/ca-1/refresh", { method: "POST" }),
      createParams({ id: "ca-1" }),
    );

    expect(mockGetValidAccessToken).not.toHaveBeenCalled();
  });

  // ── Error: profile not owned ──────────────────────────────

  it("should return 401 when account's profile is not owned by the user", async () => {
    mockRepos.connectedAccount.findById.mockResolvedValue(makeAccount());
    mockRepos.profile.findById.mockResolvedValue(makeProfile({ userId: "other-user" }));

    const res = await POST(
      createRequest("/api/v1/connected-accounts/ca-1/refresh", { method: "POST" }),
      createParams({ id: "ca-1" }),
    );

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe("UNAUTHORIZED");
    expect(data.error).toBe("Unauthorized");
  });

  // ── Error: token refresh fails ────────────────────────────

  it("should return 400 when getValidAccessToken returns null", async () => {
    mockRepos.connectedAccount.findById.mockResolvedValue(makeAccount());
    mockRepos.profile.findById.mockResolvedValue(makeProfile());
    mockGetValidAccessToken.mockResolvedValue(null);

    const res = await POST(
      createRequest("/api/v1/connected-accounts/ca-1/refresh", { method: "POST" }),
      createParams({ id: "ca-1" }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.error).toContain("Failed to refresh token");
  });
});
