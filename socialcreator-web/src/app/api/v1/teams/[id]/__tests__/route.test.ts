/**
 * Unit tests for GET / PUT / DELETE /api/v1/teams/:id
 *
 * Verifies:
 * - GET returns team for owner and member, 401 for non-member, 404 when not found
 * - PUT updates name for owner, 401 for non-owner, 404 when not found
 * - DELETE removes team for owner, 401 for non-owner, 404 when not found
 *
 * Uses mocked dependencies — no real database needed.
 * withApiMiddleware is mocked as pass-through (auth/rate-limit tested separately).
 */

import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit-redis", () => ({ withRateLimit: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock withApiMiddleware as a pass-through so route handlers are tested
// in isolation. Auth/rate-limit behavior is tested separately in
// api-middleware.integration.test.ts.
vi.mock("@/lib/api-middleware", () => {
  const withApiMiddleware = (handler: (ctx: any, params?: any) => Promise<NextResponse>) => {
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

// Mock api-errors with real NextResponse wrappers so response assertions work
vi.mock("@/lib/api-errors", () => {
  const { NextResponse } = require("next/server");
  return {
    badRequest: vi.fn((message: string) =>
      NextResponse.json({ error: message, code: "VALIDATION_ERROR" }, { status: 400 }),
    ),
    unauthorized: vi.fn(() =>
      NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 }),
    ),
    notFound: vi.fn((resource = "Resource") =>
      NextResponse.json({ error: `${resource} not found`, code: "NOT_FOUND" }, { status: 404 }),
    ),
  };
});

// Repository mocks
const mockRepos = {
  team: {
    findById: vi.fn(),
    findByOwnerId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  teamMember: {
    findByUserId: vi.fn(),
    findByTeamId: vi.fn(),
    addMember: vi.fn(),
  },
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => mockRepos),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks — vi.mock is hoisted, but keeping conventional order)
// ---------------------------------------------------------------------------

import { DELETE as TeamDELETE, GET as TeamGET, PUT as TeamPUT } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(path: string, options?: { method?: string; body?: unknown }): NextRequest {
  const url = `http://localhost:3000${path}`;
  const body = options?.body !== undefined ? JSON.stringify(options.body) : undefined;
  return new NextRequest(url, {
    method: options?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function createParams(params: Record<string, string>): { params: Promise<Record<string, string>> } {
  return { params: Promise.resolve(params) };
}

function makeTeam(overrides: Record<string, unknown> = {}) {
  return {
    id: "t-1",
    name: "My Team",
    ownerId: "user-abc-123",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    members: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/v1/teams/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with team data when user is the owner", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());

    const res = await TeamGET(createRequest("/api/v1/teams/t-1"), createParams({ id: "t-1" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.team.id).toBe("t-1");
    expect(data.team.name).toBe("My Team");
  });

  it("should return 200 with team data when user is a member", async () => {
    mockRepos.team.findById.mockResolvedValue(
      makeTeam({
        ownerId: "other-user",
        members: [{ userId: "user-abc-123", role: "EDITOR" }],
      }),
    );

    const res = await TeamGET(createRequest("/api/v1/teams/t-1"), createParams({ id: "t-1" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.team.id).toBe("t-1");
  });

  it("should return 401 when user is not owner or member", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam({ ownerId: "other-user", members: [] }));

    const res = await TeamGET(createRequest("/api/v1/teams/t-1"), createParams({ id: "t-1" }));
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("should return 404 when team does not exist", async () => {
    mockRepos.team.findById.mockResolvedValue(null);

    const res = await TeamGET(createRequest("/api/v1/teams/t-1"), createParams({ id: "t-1" }));
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.code).toBe("NOT_FOUND");
    expect(data.error).toContain("Team");
  });

  it("should return X-API-Version header", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());

    const res = await TeamGET(createRequest("/api/v1/teams/t-1"), createParams({ id: "t-1" }));
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });

  it("should return Cache-Control header", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());

    const res = await TeamGET(createRequest("/api/v1/teams/t-1"), createParams({ id: "t-1" }));
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});

describe("PUT /api/v1/teams/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update team name and return 200 for owner", async () => {
    const existingTeam = makeTeam();
    const updatedTeam = { ...existingTeam, name: "Updated Name" };
    mockRepos.team.findById.mockResolvedValue(existingTeam);
    mockRepos.team.update.mockResolvedValue(updatedTeam);

    const res = await TeamPUT(
      createRequest("/api/v1/teams/t-1", { method: "PUT", body: { name: "Updated Name" } }),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.team.name).toBe("Updated Name");
    expect(mockRepos.team.update).toHaveBeenCalledWith("t-1", { name: "Updated Name" });
  });

  it("should return 401 when non-owner tries to update", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam({ ownerId: "other-user" }));

    const res = await TeamPUT(
      createRequest("/api/v1/teams/t-1", { method: "PUT", body: { name: "Hacked" } }),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(401);

    expect(mockRepos.team.update).not.toHaveBeenCalled();
  });

  it("should return 404 when team does not exist", async () => {
    mockRepos.team.findById.mockResolvedValue(null);

    const res = await TeamPUT(
      createRequest("/api/v1/teams/t-1", { method: "PUT", body: { name: "Nope" } }),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(404);

    expect(mockRepos.team.update).not.toHaveBeenCalled();
  });

  it("should call update with name:undefined when body has no name property", async () => {
    const existingTeam = makeTeam();
    mockRepos.team.findById.mockResolvedValue(existingTeam);
    mockRepos.team.update.mockResolvedValue(existingTeam);

    const res = await TeamPUT(
      createRequest("/api/v1/teams/t-1", { method: "PUT", body: {} }),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(200);

    // The handler reads body.name and passes it directly; when absent it's undefined
    expect(mockRepos.team.update).toHaveBeenCalledWith("t-1", { name: undefined });
  });

  it("should return X-API-Version header", async () => {
    const existingTeam = makeTeam();
    mockRepos.team.findById.mockResolvedValue(existingTeam);
    mockRepos.team.update.mockResolvedValue(existingTeam);

    const res = await TeamPUT(
      createRequest("/api/v1/teams/t-1", { method: "PUT", body: { name: "Test" } }),
      createParams({ id: "t-1" }),
    );
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });
});

describe("DELETE /api/v1/teams/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete team and return { success: true } for owner", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());
    mockRepos.team.delete.mockResolvedValue(undefined);

    const res = await TeamDELETE(
      createRequest("/api/v1/teams/t-1", { method: "DELETE" }),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockRepos.team.delete).toHaveBeenCalledWith("t-1");
  });

  it("should return 401 when non-owner tries to delete", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam({ ownerId: "other-user" }));

    const res = await TeamDELETE(
      createRequest("/api/v1/teams/t-1", { method: "DELETE" }),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(401);

    expect(mockRepos.team.delete).not.toHaveBeenCalled();
  });

  it("should return 404 when team does not exist", async () => {
    mockRepos.team.findById.mockResolvedValue(null);

    const res = await TeamDELETE(
      createRequest("/api/v1/teams/t-1", { method: "DELETE" }),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(404);

    expect(mockRepos.team.delete).not.toHaveBeenCalled();
  });

  it("should return X-API-Version header on successful delete", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());
    mockRepos.team.delete.mockResolvedValue(undefined);

    const res = await TeamDELETE(
      createRequest("/api/v1/teams/t-1", { method: "DELETE" }),
      createParams({ id: "t-1" }),
    );
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });
});
