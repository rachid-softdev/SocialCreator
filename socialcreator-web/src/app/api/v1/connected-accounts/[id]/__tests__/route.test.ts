/**
 * Unit tests for DELETE /api/v1/connected-accounts/[id]
 *
 * Verifies:
 * - 200 on successful deletion
 * - 404 when account not found
 * - 401 when profile not found
 * - 401 when profile not owned by user
 *
 * Uses mocked dependencies — no real database needed.
 * Follows the exact mock pattern from src/app/api/v1/__tests__/routes.test.ts.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    delete: vi.fn(),
  },
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => mockRepos),
}));

// ---------------------------------------------------------------------------
// Import route handler
// ---------------------------------------------------------------------------

import { DELETE } from "../route";

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
    accessToken: "encrypted-token",
    accountName: "Test User",
    accountId: "x-user-123",
    isActive: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DELETE /api/v1/connected-accounts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path ────────────────────────────────────────────

  it("should delete own account and return 200 with success", async () => {
    const account = makeAccount();
    const profile = makeProfile();

    mockRepos.connectedAccount.findById.mockResolvedValue(account);
    mockRepos.profile.findById.mockResolvedValue(profile);
    mockRepos.connectedAccount.delete.mockResolvedValue(undefined);

    const res = await DELETE(
      createRequest("/api/v1/connected-accounts/ca-1", { method: "DELETE" }),
      createParams({ id: "ca-1" }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("should include X-API-Version header on success", async () => {
    mockRepos.connectedAccount.findById.mockResolvedValue(makeAccount());
    mockRepos.profile.findById.mockResolvedValue(makeProfile());
    mockRepos.connectedAccount.delete.mockResolvedValue(undefined);

    const res = await DELETE(
      createRequest("/api/v1/connected-accounts/ca-1", { method: "DELETE" }),
      createParams({ id: "ca-1" }),
    );

    expect(res.headers.get("X-API-Version")).toBe("v1");
  });

  it("should call delete with the correct account id", async () => {
    mockRepos.connectedAccount.findById.mockResolvedValue(makeAccount());
    mockRepos.profile.findById.mockResolvedValue(makeProfile());
    mockRepos.connectedAccount.delete.mockResolvedValue(undefined);

    await DELETE(
      createRequest("/api/v1/connected-accounts/ca-1", { method: "DELETE" }),
      createParams({ id: "ca-1" }),
    );

    expect(mockRepos.connectedAccount.delete).toHaveBeenCalledWith("ca-1");
  });

  // ── Error: account not found ──────────────────────────────

  it("should return 404 when account is not found", async () => {
    mockRepos.connectedAccount.findById.mockResolvedValue(null);

    const res = await DELETE(
      createRequest("/api/v1/connected-accounts/ca-nonexistent", { method: "DELETE" }),
      createParams({ id: "ca-nonexistent" }),
    );

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe("NOT_FOUND");
    expect(data.error).toContain("Connected account");
  });

  it("should not query profile when account is not found", async () => {
    mockRepos.connectedAccount.findById.mockResolvedValue(null);

    await DELETE(
      createRequest("/api/v1/connected-accounts/ca-nonexistent", { method: "DELETE" }),
      createParams({ id: "ca-nonexistent" }),
    );

    expect(mockRepos.profile.findById).not.toHaveBeenCalled();
    expect(mockRepos.connectedAccount.delete).not.toHaveBeenCalled();
  });

  // ── Error: profile not found ──────────────────────────────

  it("should return 401 when account's profile is not found", async () => {
    mockRepos.connectedAccount.findById.mockResolvedValue(makeAccount());
    mockRepos.profile.findById.mockResolvedValue(null);

    const res = await DELETE(
      createRequest("/api/v1/connected-accounts/ca-1", { method: "DELETE" }),
      createParams({ id: "ca-1" }),
    );

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe("UNAUTHORIZED");
    expect(data.error).toBe("Unauthorized");
  });

  // ── Error: profile not owned ──────────────────────────────

  it("should return 401 when account's profile is not owned by the user", async () => {
    mockRepos.connectedAccount.findById.mockResolvedValue(makeAccount());
    mockRepos.profile.findById.mockResolvedValue(makeProfile({ userId: "other-user" }));

    const res = await DELETE(
      createRequest("/api/v1/connected-accounts/ca-1", { method: "DELETE" }),
      createParams({ id: "ca-1" }),
    );

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe("UNAUTHORIZED");
    expect(data.error).toBe("Unauthorized");
  });

  it("should not delete when profile ownership check fails", async () => {
    mockRepos.connectedAccount.findById.mockResolvedValue(makeAccount());
    mockRepos.profile.findById.mockResolvedValue(makeProfile({ userId: "other-user" }));

    await DELETE(
      createRequest("/api/v1/connected-accounts/ca-1", { method: "DELETE" }),
      createParams({ id: "ca-1" }),
    );

    expect(mockRepos.connectedAccount.delete).not.toHaveBeenCalled();
  });
});
