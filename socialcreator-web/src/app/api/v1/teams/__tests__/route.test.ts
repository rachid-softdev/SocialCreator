/**
 * Unit tests for GET + POST /api/v1/teams
 *
 * Verifies:
 * - GET returns owned teams with role "OWNER" and member teams with correct roles
 * - GET merges owned and member teams correctly
 * - GET returns empty array when user has no teams
 * - GET filters out null member teams (membership references deleted team)
 * - POST creates team with valid name → 201
 * - POST validates name length (2–100 chars)
 * - POST handles missing body gracefully
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

import { GET as TeamsGET, POST as TeamsPOST } from "../route";

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/v1/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return owned teams with role OWNER when user has only owned teams", async () => {
    const ownedTeam = {
      id: "t-1",
      name: "My Team",
      ownerId: "user-abc-123",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    };
    mockRepos.team.findByOwnerId.mockResolvedValue([ownedTeam]);
    mockRepos.teamMember.findByUserId.mockResolvedValue([]);

    const res = await TeamsGET(createRequest("/api/v1/teams"), createParams({}));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.teams).toHaveLength(1);
    expect(data.teams[0].id).toBe("t-1");
    expect(data.teams[0].name).toBe("My Team");
    expect(data.teams[0].role).toBe("OWNER");
  });

  it("should return member teams with correct role when user has only member teams", async () => {
    mockRepos.team.findByOwnerId.mockResolvedValue([]);
    mockRepos.teamMember.findByUserId.mockResolvedValue([
      { id: "tm-1", teamId: "t-2", userId: "user-abc-123", role: "EDITOR" },
    ]);
    mockRepos.team.findById.mockResolvedValue({
      id: "t-2",
      name: "Partner Team",
      ownerId: "other-user",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    });

    const res = await TeamsGET(createRequest("/api/v1/teams"), createParams({}));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.teams).toHaveLength(1);
    expect(data.teams[0].id).toBe("t-2");
    expect(data.teams[0].name).toBe("Partner Team");
    expect(data.teams[0].role).toBe("EDITOR");
  });

  it("should merge owned and member teams into a single list", async () => {
    const ownedTeam = {
      id: "t-1",
      name: "My Team",
      ownerId: "user-abc-123",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    };
    mockRepos.team.findByOwnerId.mockResolvedValue([ownedTeam]);
    mockRepos.teamMember.findByUserId.mockResolvedValue([
      { id: "tm-1", teamId: "t-2", userId: "user-abc-123", role: "VIEWER" },
    ]);
    mockRepos.team.findById.mockResolvedValue({
      id: "t-2",
      name: "Partner Team",
      ownerId: "other-user",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    });

    const res = await TeamsGET(createRequest("/api/v1/teams"), createParams({}));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.teams).toHaveLength(2);
    expect(data.teams[0].id).toBe("t-1");
    expect(data.teams[0].role).toBe("OWNER");
    expect(data.teams[1].id).toBe("t-2");
    expect(data.teams[1].role).toBe("VIEWER");
  });

  it("should return empty teams array when user has no teams", async () => {
    mockRepos.team.findByOwnerId.mockResolvedValue([]);
    mockRepos.teamMember.findByUserId.mockResolvedValue([]);

    const res = await TeamsGET(createRequest("/api/v1/teams"), createParams({}));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.teams).toEqual([]);
  });

  it("should filter out member teams that return null from findById", async () => {
    mockRepos.team.findByOwnerId.mockResolvedValue([]);
    mockRepos.teamMember.findByUserId.mockResolvedValue([
      { id: "tm-1", teamId: "t-deleted", userId: "user-abc-123", role: "VIEWER" },
    ]);
    mockRepos.team.findById.mockResolvedValue(null);

    const res = await TeamsGET(createRequest("/api/v1/teams"), createParams({}));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.teams).toEqual([]);
  });

  it("should return Cache-Control: private, no-store header", async () => {
    mockRepos.team.findByOwnerId.mockResolvedValue([]);
    mockRepos.teamMember.findByUserId.mockResolvedValue([]);

    const res = await TeamsGET(createRequest("/api/v1/teams"), createParams({}));
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("should return X-API-Version: v1 header", async () => {
    mockRepos.team.findByOwnerId.mockResolvedValue([]);
    mockRepos.teamMember.findByUserId.mockResolvedValue([]);

    const res = await TeamsGET(createRequest("/api/v1/teams"), createParams({}));
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });
});

describe("POST /api/v1/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a team with a valid name and return 201", async () => {
    const createdTeam = {
      id: "t-1",
      name: "My Team",
      ownerId: "user-abc-123",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    };
    mockRepos.team.create.mockResolvedValue(createdTeam);

    const res = await TeamsPOST(
      createRequest("/api/v1/teams", { method: "POST", body: { name: "My Team" } }),
      createParams({}),
    );
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.team.id).toBe("t-1");
    expect(data.team.name).toBe("My Team");
    expect(mockRepos.team.create).toHaveBeenCalledWith({
      name: "My Team",
      ownerId: "user-abc-123",
    });
  });

  it("should return X-API-Version header on creation", async () => {
    mockRepos.team.create.mockResolvedValue({
      id: "t-1",
      name: "My Team",
      ownerId: "user-abc-123",
    });

    const res = await TeamsPOST(
      createRequest("/api/v1/teams", { method: "POST", body: { name: "My Team" } }),
      createParams({}),
    );
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });

  it("should return 400 when name is too short (1 character)", async () => {
    const res = await TeamsPOST(
      createRequest("/api/v1/teams", { method: "POST", body: { name: "A" } }),
      createParams({}),
    );
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when name is too long (101 characters)", async () => {
    const res = await TeamsPOST(
      createRequest("/api/v1/teams", { method: "POST", body: { name: "A".repeat(101) } }),
      createParams({}),
    );
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when name is empty string", async () => {
    const res = await TeamsPOST(
      createRequest("/api/v1/teams", { method: "POST", body: { name: "" } }),
      createParams({}),
    );
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("should throw when body is missing (request.json fails)", async () => {
    // When Content-Type is application/json but no body is provided,
    // request.json() throws, which the middleware would normally catch.
    // With our pass-through mock, the error propagates.
    await expect(
      TeamsPOST(createRequest("/api/v1/teams", { method: "POST" }), createParams({})),
    ).rejects.toThrow();
  });

  it("should not call teamRepo.create when validation fails", async () => {
    await TeamsPOST(
      createRequest("/api/v1/teams", { method: "POST", body: { name: "A" } }),
      createParams({}),
    );
    expect(mockRepos.team.create).not.toHaveBeenCalled();
  });
});
