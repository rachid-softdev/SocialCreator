/**
 * Unit tests for GET + POST /api/v1/teams/:id/invitations
 *
 * Verifies:
 * - POST adds member with role for owner, 401 for non-owner, 404 when not found
 * - POST validates userId (required) and role (must be valid enum)
 * - POST defaults role to VIEWER when omitted
 * - GET returns members for owner or member, 401 for non-member, 404 when not found
 * - GET returns empty array when team has no members
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

import { GET as TeamInvitationsGET, POST as TeamInvitationsPOST } from "../route";

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

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: "tm-1",
    teamId: "t-1",
    userId: "u-2",
    role: "VIEWER",
    invitedAt: new Date("2024-01-02"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests – POST /api/v1/teams/:id/invitations (add member)
// ---------------------------------------------------------------------------

describe("POST /api/v1/teams/:id/invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should add a member with specified role and return 201 for owner", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());
    const addedMember = makeMember({ role: "ADMIN" });
    mockRepos.teamMember.addMember.mockResolvedValue(addedMember);

    const res = await TeamInvitationsPOST(
      createRequest("/api/v1/teams/t-1/invitations", {
        method: "POST",
        body: { userId: "u-2", role: "ADMIN" },
      }),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.member.id).toBe("tm-1");
    expect(data.member.role).toBe("ADMIN");
    expect(data.member.userId).toBe("u-2");
    expect(mockRepos.teamMember.addMember).toHaveBeenCalledWith({
      teamId: "t-1",
      userId: "u-2",
      role: "ADMIN",
    });
  });

  it("should add a member with default VIEWER role when role is omitted", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());
    const addedMember = makeMember({ role: "VIEWER" });
    mockRepos.teamMember.addMember.mockResolvedValue(addedMember);

    const res = await TeamInvitationsPOST(
      createRequest("/api/v1/teams/t-1/invitations", {
        method: "POST",
        body: { userId: "u-2" },
      }),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.member.role).toBe("VIEWER");
    expect(mockRepos.teamMember.addMember).toHaveBeenCalledWith({
      teamId: "t-1",
      userId: "u-2",
      role: undefined, // Handler passes role from body; Zod defaults to undefined when absent
    });
  });

  it("should return 401 when non-owner tries to add a member", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam({ ownerId: "other-user" }));

    const res = await TeamInvitationsPOST(
      createRequest("/api/v1/teams/t-1/invitations", {
        method: "POST",
        body: { userId: "u-2", role: "EDITOR" },
      }),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(401);

    expect(mockRepos.teamMember.addMember).not.toHaveBeenCalled();
  });

  it("should return 404 when team does not exist", async () => {
    mockRepos.team.findById.mockResolvedValue(null);

    const res = await TeamInvitationsPOST(
      createRequest("/api/v1/teams/t-1/invitations", {
        method: "POST",
        body: { userId: "u-2" },
      }),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(404);

    expect(mockRepos.teamMember.addMember).not.toHaveBeenCalled();
  });

  it("should return 400 when userId is missing from body", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());

    const res = await TeamInvitationsPOST(
      createRequest("/api/v1/teams/t-1/invitations", {
        method: "POST",
        body: { role: "EDITOR" },
      }),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.error).toBeDefined();
  });

  it("should return 400 when userId is an empty string", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());

    const res = await TeamInvitationsPOST(
      createRequest("/api/v1/teams/t-1/invitations", {
        method: "POST",
        body: { userId: "" },
      }),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when role is invalid", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());

    const res = await TeamInvitationsPOST(
      createRequest("/api/v1/teams/t-1/invitations", {
        method: "POST",
        body: { userId: "u-2", role: "SUPER_ADMIN" },
      }),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.error).toBeDefined();
  });

  it("should return X-API-Version header on successful creation", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());
    mockRepos.teamMember.addMember.mockResolvedValue(makeMember());

    const res = await TeamInvitationsPOST(
      createRequest("/api/v1/teams/t-1/invitations", {
        method: "POST",
        body: { userId: "u-2" },
      }),
      createParams({ id: "t-1" }),
    );
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });
});

// ---------------------------------------------------------------------------
// Tests – GET /api/v1/teams/:id/invitations (list members)
// ---------------------------------------------------------------------------

describe("GET /api/v1/teams/:id/invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return members list for the owner", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());
    const members = [
      makeMember({ id: "tm-1", userId: "u-2", role: "EDITOR" }),
      makeMember({ id: "tm-2", userId: "u-3", role: "VIEWER" }),
    ];
    mockRepos.teamMember.findByTeamId.mockResolvedValue(members);

    const res = await TeamInvitationsGET(
      createRequest("/api/v1/teams/t-1/invitations"),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.members).toHaveLength(2);
    expect(data.members[0].id).toBe("tm-1");
    expect(data.members[1].id).toBe("tm-2");
    expect(mockRepos.teamMember.findByTeamId).toHaveBeenCalledWith("t-1");
  });

  it("should return members list for a team member", async () => {
    mockRepos.team.findById.mockResolvedValue(
      makeTeam({
        ownerId: "other-user",
        members: [{ userId: "user-abc-123", role: "EDITOR" }],
      }),
    );
    mockRepos.teamMember.findByTeamId.mockResolvedValue([
      makeMember({ id: "tm-1", userId: "u-2", role: "EDITOR" }),
    ]);

    const res = await TeamInvitationsGET(
      createRequest("/api/v1/teams/t-1/invitations"),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.members).toHaveLength(1);
  });

  it("should return 401 when user is not owner or member", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam({ ownerId: "other-user", members: [] }));

    const res = await TeamInvitationsGET(
      createRequest("/api/v1/teams/t-1/invitations"),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(401);

    expect(mockRepos.teamMember.findByTeamId).not.toHaveBeenCalled();
  });

  it("should return empty members array when team has no members", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());
    mockRepos.teamMember.findByTeamId.mockResolvedValue([]);

    const res = await TeamInvitationsGET(
      createRequest("/api/v1/teams/t-1/invitations"),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.members).toEqual([]);
  });

  it("should return 404 when team does not exist", async () => {
    mockRepos.team.findById.mockResolvedValue(null);

    const res = await TeamInvitationsGET(
      createRequest("/api/v1/teams/t-1/invitations"),
      createParams({ id: "t-1" }),
    );
    expect(res.status).toBe(404);

    expect(mockRepos.teamMember.findByTeamId).not.toHaveBeenCalled();
  });

  it("should return X-API-Version header", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());
    mockRepos.teamMember.findByTeamId.mockResolvedValue([]);

    const res = await TeamInvitationsGET(
      createRequest("/api/v1/teams/t-1/invitations"),
      createParams({ id: "t-1" }),
    );
    expect(res.headers.get("X-API-Version")).toBe("v1");
  });

  it("should return Cache-Control: private, no-store header", async () => {
    mockRepos.team.findById.mockResolvedValue(makeTeam());
    mockRepos.teamMember.findByTeamId.mockResolvedValue([]);

    const res = await TeamInvitationsGET(
      createRequest("/api/v1/teams/t-1/invitations"),
      createParams({ id: "t-1" }),
    );
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
