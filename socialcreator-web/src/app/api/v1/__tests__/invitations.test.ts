/**
 * Integration tests for invitation API routes
 *
 * Tests:
 * - POST /api/v1/invitations — create invitation
 * - GET /api/v1/invitations — list pending invitations
 * - GET /api/v1/invitations/[token] — get invitation details
 * - POST /api/v1/invitations/[token]/accept — accept invitation
 * - POST /api/v1/invitations/[token]/decline — decline invitation
 * - Error cases: expired token, wrong email, non-OWNER/ADMIN
 */

import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit-redis", () => ({ withRateLimit: vi.fn() }));

const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
vi.mock("@/lib/logger", () => ({
  default: mockLogger,
}));

// Mock withApiMiddleware as a pass-through
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

// Repository mocks
const mockRepos = {
  team: {
    findById: vi.fn(),
  },
  invitation: {
    findByToken: vi.fn(),
    create: vi.fn(),
    findPendingByEmail: vi.fn(),
    findPendingByTeamIdAndEmail: vi.fn(),
    updateStatus: vi.fn(),
  },
  user: {
    findById: vi.fn(),
  },
  teamMember: {
    addMember: vi.fn(),
    findByTeamId: vi.fn(),
  },
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => mockRepos),
}));

// ---------------------------------------------------------------------------
// Import routes
// ---------------------------------------------------------------------------

import { POST as InvitationAcceptPOST } from "@/app/api/v1/invitations/[token]/accept/route";
import { POST as InvitationDeclinePOST } from "@/app/api/v1/invitations/[token]/decline/route";
import { GET as InvitationByTokenGET } from "@/app/api/v1/invitations/[token]/route";
import { GET as InvitationsGet, POST as InvitationsPost } from "@/app/api/v1/invitations/route";

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

const mockTeamWithOwner = {
  id: "team-1",
  name: "Test Team",
  ownerId: "user-abc-123",
  members: [],
};

const mockUser = {
  id: "user-abc-123",
  email: "user@example.com",
  name: "Test User",
};

const mockInvitation = {
  id: "inv-1",
  teamId: "team-1",
  invitedByUserId: "user-abc-123",
  email: "invited@example.com",
  role: "EDITOR",
  token: "token-abc-123",
  status: "PENDING",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
};

const expiredInvitation = {
  ...mockInvitation,
  expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
};

const acceptedInvitation = {
  ...mockInvitation,
  status: "ACCEPTED",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create invitation as team owner", async () => {
    mockRepos.team.findById.mockResolvedValue(mockTeamWithOwner);
    mockRepos.invitation.create.mockResolvedValue(mockInvitation);

    const res = await InvitationsPost(
      createRequest("/api/v1/invitations", {
        method: "POST",
        body: { teamId: "team-1", email: "invited@example.com", role: "EDITOR" },
      }),
      createParams({}),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.invitation.email).toBe("invited@example.com");
    expect(data.invitation.token).toBeUndefined();
    expect(res.headers.get("X-API-Version")).toBe("v1");
    expect(mockRepos.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        email: "invited@example.com",
        role: "EDITOR",
      }),
    );
  });

  it("should create invitation as team ADMIN (via members check)", async () => {
    mockRepos.team.findById.mockResolvedValue({
      ...mockTeamWithOwner,
      ownerId: "other-owner",
      members: [{ userId: "user-abc-123", role: "ADMIN" }],
    });
    mockRepos.invitation.create.mockResolvedValue(mockInvitation);

    const res = await InvitationsPost(
      createRequest("/api/v1/invitations", {
        method: "POST",
        body: { teamId: "team-1", email: "invited@example.com", role: "VIEWER" },
      }),
      createParams({}),
    );

    expect(res.status).toBe(201);
  });

  it("should reject non-OWNER/ADMIN with 401", async () => {
    mockRepos.team.findById.mockResolvedValue({
      ...mockTeamWithOwner,
      ownerId: "other-owner",
      members: [{ userId: "user-abc-123", role: "VIEWER" }],
    });

    const res = await InvitationsPost(
      createRequest("/api/v1/invitations", {
        method: "POST",
        body: { teamId: "team-1", email: "invited@example.com", role: "EDITOR" },
      }),
      createParams({}),
    );

    expect(res.status).toBe(401);
  });

  it("should return 404 when team does not exist", async () => {
    mockRepos.team.findById.mockResolvedValue(null);

    const res = await InvitationsPost(
      createRequest("/api/v1/invitations", {
        method: "POST",
        body: { teamId: "nonexistent", email: "test@example.com", role: "EDITOR" },
      }),
      createParams({}),
    );

    expect(res.status).toBe(404);
  });

  it("should return 400 for invalid email", async () => {
    const res = await InvitationsPost(
      createRequest("/api/v1/invitations", {
        method: "POST",
        body: { teamId: "team-1", email: "not-an-email", role: "EDITOR" },
      }),
      createParams({}),
    );

    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return list of pending invitations", async () => {
    mockRepos.user.findById.mockResolvedValue(mockUser);
    mockRepos.invitation.findPendingByEmail.mockResolvedValue([mockInvitation]);

    const res = await InvitationsGet(createRequest("/api/v1/invitations"), createParams({}));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invitations).toHaveLength(1);
    expect(data.invitations[0].id).toBe("inv-1");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("should return 404 when user not found", async () => {
    mockRepos.user.findById.mockResolvedValue(null);

    const res = await InvitationsGet(createRequest("/api/v1/invitations"), createParams({}));

    expect(res.status).toBe(404);
  });

  it("should return empty list when no pending invitations", async () => {
    mockRepos.user.findById.mockResolvedValue(mockUser);
    mockRepos.invitation.findPendingByEmail.mockResolvedValue([]);

    const res = await InvitationsGet(createRequest("/api/v1/invitations"), createParams({}));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invitations).toHaveLength(0);
  });
});

describe("GET /api/v1/invitations/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return invitation details by token", async () => {
    mockRepos.invitation.findByToken.mockResolvedValue(mockInvitation);

    const res = await InvitationByTokenGET(
      createRequest("/api/v1/invitations/token-abc-123"),
      createParams({ token: "token-abc-123" }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invitation.id).toBe("inv-1");
    expect(data.invitation.email).toBeUndefined(); // email stripped for security
  });

  it("should return 410 for expired token", async () => {
    mockRepos.invitation.findByToken.mockResolvedValue(expiredInvitation);

    const res = await InvitationByTokenGET(
      createRequest("/api/v1/invitations/expired-token"),
      createParams({ token: "expired-token" }),
    );

    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.code).toBe("EXPIRED");
  });

  it("should return 410 for non-pending invitation", async () => {
    mockRepos.invitation.findByToken.mockResolvedValue(acceptedInvitation);

    const res = await InvitationByTokenGET(
      createRequest("/api/v1/invitations/accepted-token"),
      createParams({ token: "accepted-token" }),
    );

    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.code).toBe("ACCEPTED");
  });

  it("should return 404 when token not found", async () => {
    mockRepos.invitation.findByToken.mockResolvedValue(null);

    const res = await InvitationByTokenGET(
      createRequest("/api/v1/invitations/unknown-token"),
      createParams({ token: "unknown-token" }),
    );

    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/invitations/[token]/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should accept invitation and create team member", async () => {
    mockRepos.invitation.findByToken.mockResolvedValue(mockInvitation);
    mockRepos.user.findById.mockResolvedValue({ ...mockUser, email: "invited@example.com" });
    mockRepos.teamMember.findByTeamId.mockResolvedValue([]);
    mockRepos.teamMember.addMember.mockResolvedValue({ id: "tm-1" });
    mockRepos.invitation.updateStatus.mockResolvedValue({ ...mockInvitation, status: "ACCEPTED" });

    const res = await InvitationAcceptPOST(
      createRequest("/api/v1/invitations/token-abc-123/accept", { method: "POST" }),
      createParams({ token: "token-abc-123" }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("accepted");
    expect(mockRepos.teamMember.addMember).toHaveBeenCalledWith({
      teamId: "team-1",
      userId: "user-abc-123",
      role: "EDITOR",
    });
    expect(mockRepos.invitation.updateStatus).toHaveBeenCalledWith("inv-1", "ACCEPTED");
  });

  it("should return 410 for expired token (and mark as EXPIRED)", async () => {
    mockRepos.invitation.findByToken.mockResolvedValue(expiredInvitation);

    const res = await InvitationAcceptPOST(
      createRequest("/api/v1/invitations/expired-token/accept", { method: "POST" }),
      createParams({ token: "expired-token" }),
    );

    expect(res.status).toBe(410);
    expect(mockRepos.invitation.updateStatus).toHaveBeenCalledWith(expiredInvitation.id, "EXPIRED");
  });

  it("should return 403 when email does not match", async () => {
    mockRepos.invitation.findByToken.mockResolvedValue(mockInvitation);
    mockRepos.user.findById.mockResolvedValue({ ...mockUser, email: "wrong@example.com" });

    const res = await InvitationAcceptPOST(
      createRequest("/api/v1/invitations/token-abc-123/accept", { method: "POST" }),
      createParams({ token: "token-abc-123" }),
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("different email");
  });

  it("should return 404 when token not found", async () => {
    mockRepos.invitation.findByToken.mockResolvedValue(null);

    const res = await InvitationAcceptPOST(
      createRequest("/api/v1/invitations/unknown/accept", { method: "POST" }),
      createParams({ token: "unknown" }),
    );

    expect(res.status).toBe(404);
  });

  it("should handle already-member case gracefully", async () => {
    mockRepos.invitation.findByToken.mockResolvedValue(mockInvitation);
    mockRepos.user.findById.mockResolvedValue({ ...mockUser, email: "invited@example.com" });
    mockRepos.teamMember.findByTeamId.mockResolvedValue([{ userId: "user-abc-123" }]);

    const res = await InvitationAcceptPOST(
      createRequest("/api/v1/invitations/token-abc-123/accept", { method: "POST" }),
      createParams({ token: "token-abc-123" }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("already a member");
    expect(mockRepos.invitation.updateStatus).toHaveBeenCalledWith("inv-1", "ACCEPTED");
    expect(mockRepos.teamMember.addMember).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/invitations/[token]/decline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should decline invitation and mark as REJECTED", async () => {
    mockRepos.invitation.findByToken.mockResolvedValue(mockInvitation);
    mockRepos.user.findById.mockResolvedValue({ ...mockUser, email: "invited@example.com" });
    mockRepos.invitation.updateStatus.mockResolvedValue({ ...mockInvitation, status: "REJECTED" });

    const res = await InvitationDeclinePOST(
      createRequest("/api/v1/invitations/token-abc-123/decline", { method: "POST" }),
      createParams({ token: "token-abc-123" }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("declined");
    expect(mockRepos.invitation.updateStatus).toHaveBeenCalledWith("inv-1", "REJECTED");
  });

  it("should return 403 when email does not match", async () => {
    mockRepos.invitation.findByToken.mockResolvedValue(mockInvitation);
    mockRepos.user.findById.mockResolvedValue({ ...mockUser, email: "wrong@example.com" });

    const res = await InvitationDeclinePOST(
      createRequest("/api/v1/invitations/token-abc-123/decline", { method: "POST" }),
      createParams({ token: "token-abc-123" }),
    );

    expect(res.status).toBe(403);
  });

  it("should return 410 for already processed invitation", async () => {
    mockRepos.invitation.findByToken.mockResolvedValue(acceptedInvitation);

    const res = await InvitationDeclinePOST(
      createRequest("/api/v1/invitations/accepted-token/decline", { method: "POST" }),
      createParams({ token: "accepted-token" }),
    );

    expect(res.status).toBe(410);
  });

  it("should return 404 when token not found", async () => {
    mockRepos.invitation.findByToken.mockResolvedValue(null);

    const res = await InvitationDeclinePOST(
      createRequest("/api/v1/invitations/unknown/decline", { method: "POST" }),
      createParams({ token: "unknown" }),
    );

    expect(res.status).toBe(404);
  });
});
