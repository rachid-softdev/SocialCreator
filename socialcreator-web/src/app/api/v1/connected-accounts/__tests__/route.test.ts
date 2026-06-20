/**
 * Unit tests for /api/v1/connected-accounts
 *
 * Tests GET (list) and POST (create) for connected accounts.
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
    findByProfileId: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => mockRepos),
}));

// ---------------------------------------------------------------------------
// Import route handlers
// ---------------------------------------------------------------------------

import { GET, POST } from "../route";

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
    refreshToken: "encrypted-refresh",
    expiresAt: new Date("2025-12-31T23:59:59Z"),
    accountId: "x-user-123",
    accountName: "Test User",
    accountAvatarUrl: "https://example.com/avatar.jpg",
    isActive: true,
    ...overrides,
  };
}

const validCreatePayload = {
  profileId: "p-1",
  platform: "X",
  accessToken: "xoxb-abc-123",
  refreshToken: "xoxb-refresh-456",
  expiresAt: "2025-12-31T23:59:59Z",
  accountId: "x-user-123",
  accountName: "Test User",
  accountAvatarUrl: "https://example.com/avatar.jpg",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/v1/connected-accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path ────────────────────────────────────────────

  it("should return accounts for a valid profileId", async () => {
    const profile = makeProfile();
    const accounts = [
      makeAccount({ id: "ca-1", platform: "X", accountName: "X Account" }),
      makeAccount({ id: "ca-2", platform: "LINKEDIN", accountName: "LinkedIn Account" }),
    ];

    mockRepos.profile.findById.mockResolvedValue(profile);
    mockRepos.connectedAccount.findByProfileId.mockResolvedValue(accounts);

    const res = await GET(
      createRequest("/api/v1/connected-accounts?profileId=p-1"),
      createParams({}),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.accounts).toHaveLength(2);
    expect(data.accounts[0].accountName).toBe("X Account");
    expect(data.accounts[1].accountName).toBe("LinkedIn Account");
  });

  it("should include Cache-Control and X-API-Version headers on success", async () => {
    mockRepos.profile.findById.mockResolvedValue(makeProfile());
    mockRepos.connectedAccount.findByProfileId.mockResolvedValue([]);

    const res = await GET(
      createRequest("/api/v1/connected-accounts?profileId=p-1"),
      createParams({}),
    );

    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });

  it("should return empty accounts array when no accounts exist", async () => {
    mockRepos.profile.findById.mockResolvedValue(makeProfile());
    mockRepos.connectedAccount.findByProfileId.mockResolvedValue([]);

    const res = await GET(
      createRequest("/api/v1/connected-accounts?profileId=p-1"),
      createParams({}),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.accounts).toEqual([]);
  });

  // ── Validation errors ─────────────────────────────────────

  it("should return 400 when profileId is missing", async () => {
    const res = await GET(createRequest("/api/v1/connected-accounts"), createParams({}));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("profileId is required");
  });

  it("should return 404 when profile is not found", async () => {
    mockRepos.profile.findById.mockResolvedValue(null);

    const res = await GET(
      createRequest("/api/v1/connected-accounts?profileId=nonexistent"),
      createParams({}),
    );

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe("NOT_FOUND");
    expect(data.error).toContain("Profile");
  });

  it("should return 404 when profile is not owned by the user", async () => {
    mockRepos.profile.findById.mockResolvedValue(makeProfile({ userId: "other-user" }));

    const res = await GET(
      createRequest("/api/v1/connected-accounts?profileId=p-1"),
      createParams({}),
    );

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe("NOT_FOUND");
    expect(data.error).toContain("Profile");
  });

  it("should pass the profileId to the repo when fetching accounts", async () => {
    mockRepos.profile.findById.mockResolvedValue(makeProfile());
    mockRepos.connectedAccount.findByProfileId.mockResolvedValue([]);

    await GET(createRequest("/api/v1/connected-accounts?profileId=p-1"), createParams({}));

    expect(mockRepos.connectedAccount.findByProfileId).toHaveBeenCalledWith("p-1");
  });
});

describe("POST /api/v1/connected-accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path ────────────────────────────────────────────

  it("should create an account and return 201 with the account data", async () => {
    mockRepos.profile.findById.mockResolvedValue(makeProfile());
    const createdAccount = makeAccount({ id: "ca-new", accountName: "Test User" });
    mockRepos.connectedAccount.create.mockResolvedValue(createdAccount);

    const res = await POST(
      createRequest("/api/v1/connected-accounts", { method: "POST", body: validCreatePayload }),
      createParams({}),
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.account).toBeDefined();
    expect(data.account.id).toBe("ca-new");
    expect(data.account.accountName).toBe("Test User");
  });

  it("should return X-API-Version header on creation", async () => {
    mockRepos.profile.findById.mockResolvedValue(makeProfile());
    mockRepos.connectedAccount.create.mockResolvedValue(makeAccount());

    const res = await POST(
      createRequest("/api/v1/connected-accounts", { method: "POST", body: validCreatePayload }),
      createParams({}),
    );

    expect(res.headers.get("X-API-Version")).toBe("v1");
  });

  it("should pass the correct data to the repository", async () => {
    mockRepos.profile.findById.mockResolvedValue(makeProfile());
    mockRepos.connectedAccount.create.mockResolvedValue(makeAccount());

    await POST(
      createRequest("/api/v1/connected-accounts", { method: "POST", body: validCreatePayload }),
      createParams({}),
    );

    expect(mockRepos.connectedAccount.create).toHaveBeenCalledWith({
      profileId: "p-1",
      platform: "X",
      accessToken: "xoxb-abc-123",
      refreshToken: "xoxb-refresh-456",
      expiresAt: new Date("2025-12-31T23:59:59Z"),
      accountId: "x-user-123",
      accountName: "Test User",
      accountAvatarUrl: "https://example.com/avatar.jpg",
    });
  });

  it("should create an account without optional fields", async () => {
    mockRepos.profile.findById.mockResolvedValue(makeProfile());
    const minimalPayload = {
      profileId: "p-1",
      platform: "INSTAGRAM",
      accessToken: "ig-token",
      accountId: "ig-user-456",
      accountName: "IG User",
    };
    mockRepos.connectedAccount.create.mockResolvedValue(makeAccount({ platform: "INSTAGRAM" }));

    const res = await POST(
      createRequest("/api/v1/connected-accounts", { method: "POST", body: minimalPayload }),
      createParams({}),
    );

    expect(res.status).toBe(201);
    expect(mockRepos.connectedAccount.create).toHaveBeenCalledWith({
      profileId: "p-1",
      platform: "INSTAGRAM",
      accessToken: "ig-token",
      refreshToken: undefined,
      expiresAt: undefined,
      accountId: "ig-user-456",
      accountName: "IG User",
      accountAvatarUrl: undefined,
    });
  });

  // ── Validation errors ─────────────────────────────────────

  it("should return 400 when required fields are missing", async () => {
    const res = await POST(
      createRequest("/api/v1/connected-accounts", {
        method: "POST",
        body: { profileId: "p-1" },
      }),
      createParams({}),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when platform is invalid", async () => {
    const res = await POST(
      createRequest("/api/v1/connected-accounts", {
        method: "POST",
        body: { ...validCreatePayload, platform: "SNAPCHAT" },
      }),
      createParams({}),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when accountId is empty", async () => {
    const res = await POST(
      createRequest("/api/v1/connected-accounts", {
        method: "POST",
        body: { ...validCreatePayload, accountId: "" },
      }),
      createParams({}),
    );

    expect(res.status).toBe(400);
  });

  it("should return 400 when expiresAt is not a valid datetime", async () => {
    const res = await POST(
      createRequest("/api/v1/connected-accounts", {
        method: "POST",
        body: { ...validCreatePayload, expiresAt: "not-a-datetime" },
      }),
      createParams({}),
    );

    expect(res.status).toBe(400);
  });

  it("should return 400 when accountAvatarUrl is not a valid URL", async () => {
    const res = await POST(
      createRequest("/api/v1/connected-accounts", {
        method: "POST",
        body: { ...validCreatePayload, accountAvatarUrl: "not-a-url" },
      }),
      createParams({}),
    );

    expect(res.status).toBe(400);
  });

  // ── Ownership errors ──────────────────────────────────────

  it("should return 404 when profile is not found", async () => {
    mockRepos.profile.findById.mockResolvedValue(null);

    const res = await POST(
      createRequest("/api/v1/connected-accounts", { method: "POST", body: validCreatePayload }),
      createParams({}),
    );

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe("NOT_FOUND");
  });

  it("should return 404 when profile is not owned by the user", async () => {
    mockRepos.profile.findById.mockResolvedValue(makeProfile({ userId: "other-user" }));

    const res = await POST(
      createRequest("/api/v1/connected-accounts", { method: "POST", body: validCreatePayload }),
      createParams({}),
    );

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe("NOT_FOUND");
  });

  it("should not call create when profile ownership check fails", async () => {
    mockRepos.profile.findById.mockResolvedValue(makeProfile({ userId: "other-user" }));

    await POST(
      createRequest("/api/v1/connected-accounts", { method: "POST", body: validCreatePayload }),
      createParams({}),
    );

    expect(mockRepos.connectedAccount.create).not.toHaveBeenCalled();
  });
});
