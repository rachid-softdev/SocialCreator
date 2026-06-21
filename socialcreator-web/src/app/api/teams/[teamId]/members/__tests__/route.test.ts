import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock variables (needed before vi.mock factories)
// ---------------------------------------------------------------------------
const mockPrisma = vi.hoisted(() => ({
  team: {
    findFirst: vi.fn(),
  },
  teamMember: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { auth } from "@/lib/auth";
import { DELETE, GET, POST, PUT } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createGetRequest() {
  return new NextRequest("http://localhost:3000/api/teams/team-123/members");
}

function createPostRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/teams/team-123/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(memberId = "member-123") {
  return new NextRequest(`http://localhost:3000/api/teams/team-123/members/${memberId}`, {
    method: "DELETE",
  });
}

function createPutRequest(body: unknown, memberId = "member-123") {
  return new NextRequest(`http://localhost:3000/api/teams/team-123/members/${memberId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createParams(overrides?: { teamId?: string; memberId?: string }) {
  return {
    params: Promise.resolve({
      teamId: overrides?.teamId ?? "team-123",
      memberId: overrides?.memberId ?? "member-123",
    }),
  };
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const mockTeam = {
  id: "team-123",
  name: "My Team",
  ownerId: "user-abc-123",
};

const mockMembers = [
  {
    id: "member-123",
    teamId: "team-123",
    userId: "user-abc-123",
    role: "OWNER",
    joinedAt: new Date("2024-01-01"),
    user: {
      id: "user-abc-123",
      name: "Test User",
      email: "test@example.com",
      image: null,
    },
  },
  {
    id: "member-456",
    teamId: "team-123",
    userId: "user-456",
    role: "EDITOR",
    joinedAt: new Date("2024-01-02"),
    user: {
      id: "user-456",
      name: "Another User",
      email: "another@example.com",
      image: null,
    },
  },
];

const invitedUser = {
  id: "user-789",
  name: "Invited User",
  email: "invited@example.com",
};

// ---------------------------------------------------------------------------
// Tests: GET /api/teams/[teamId]/members
// ---------------------------------------------------------------------------
describe("GET /api/teams/[teamId]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
    mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
  });

  it("should return 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await GET(createGetRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 200 with list of members", async () => {
    mockPrisma.teamMember.findMany.mockResolvedValue(mockMembers);

    const res = await GET(createGetRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members).toHaveLength(2);
    expect(data.members[0].role).toBe("OWNER");
    expect(data.members[1].role).toBe("EDITOR");
  });

  it("should return 404 when team is not found or user not a member", async () => {
    mockPrisma.team.findFirst.mockResolvedValue(null);

    const res = await GET(createGetRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Team not found");
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/teams/[teamId]/members
// ---------------------------------------------------------------------------
describe("POST /api/teams/[teamId]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
    mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
    mockPrisma.user.findUnique.mockResolvedValue(invitedUser);
    mockPrisma.teamMember.findUnique.mockResolvedValue(null);
  });

  it("should return 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(createPostRequest({ email: "invited@example.com" }), createParams());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 201 and add a member with valid email", async () => {
    const createdMember = {
      id: "member-789",
      teamId: "team-123",
      userId: "user-789",
      role: "VIEWER",
      joinedAt: new Date(),
      user: {
        id: "user-789",
        name: "Invited User",
        email: "invited@example.com",
        image: null,
      },
    };
    mockPrisma.teamMember.create.mockResolvedValue(createdMember);

    const res = await POST(
      createPostRequest({ email: "invited@example.com", role: "VIEWER" }),
      createParams(),
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.member).toMatchObject({
      id: "member-789",
      role: "VIEWER",
      userId: "user-789",
    });
  });

  it("should return 201 with default role VIEWER when role is not specified", async () => {
    const createdMember = {
      id: "member-789",
      teamId: "team-123",
      userId: "user-789",
      role: "VIEWER",
      joinedAt: new Date(),
      user: {
        id: "user-789",
        name: "Invited User",
        email: "invited@example.com",
        image: null,
      },
    };
    mockPrisma.teamMember.create.mockResolvedValue(createdMember);

    const res = await POST(createPostRequest({ email: "invited@example.com" }), createParams());
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.member.role).toBe("VIEWER");
  });

  it("should return 400 when email is invalid", async () => {
    const res = await POST(createPostRequest({ email: "not-an-email" }), createParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("should return 400 when email is missing", async () => {
    const res = await POST(createPostRequest({}), createParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("should return 404 when invited user does not exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await POST(createPostRequest({ email: "unknown@example.com" }), createParams());
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("User not found");
  });

  it("should return 400 when user is already a member", async () => {
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "existing-member",
      teamId: "team-123",
      userId: "user-789",
    });

    const res = await POST(createPostRequest({ email: "invited@example.com" }), createParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("User is already a member of this team");
  });
});

// ---------------------------------------------------------------------------
// Tests: DELETE /api/teams/[teamId]/members/[memberId]
// ---------------------------------------------------------------------------
describe("DELETE /api/teams/[teamId]/members/[memberId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
    mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "member-123",
      teamId: "team-123",
      userId: "user-456",
      role: "EDITOR",
    });
  });

  it("should return 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await DELETE(createDeleteRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 200 and remove a member successfully", async () => {
    mockPrisma.teamMember.delete.mockResolvedValue({});

    const res = await DELETE(createDeleteRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.teamMember.delete).toHaveBeenCalledWith({
      where: { id: "member-123" },
    });
  });

  it("should return 404 when member is not found", async () => {
    mockPrisma.teamMember.findUnique.mockResolvedValue(null);

    const res = await DELETE(createDeleteRequest(), createParams());
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Member not found");
  });

  it("should return 400 when trying to remove the team owner", async () => {
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "member-owner",
      teamId: "team-123",
      userId: "user-abc-123",
      role: "OWNER",
    });

    const res = await DELETE(createDeleteRequest("member-owner"), createParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Cannot remove the team owner");
  });

  it("should return 403 when a non-owner tries to remove an admin", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-not-owner" },
    });
    mockPrisma.team.findFirst.mockResolvedValue({
      ...mockTeam,
      ownerId: "user-abc-123",
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "member-admin",
      teamId: "team-123",
      userId: "user-admin",
      role: "ADMIN",
    });

    const res = await DELETE(createDeleteRequest("member-admin"), {
      params: Promise.resolve({ teamId: "team-123", memberId: "member-admin" }),
    });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Only the team owner can remove admins");
  });
});

// ---------------------------------------------------------------------------
// Tests: PUT /api/teams/[teamId]/members/[memberId]
// ---------------------------------------------------------------------------
describe("PUT /api/teams/[teamId]/members/[memberId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
    mockPrisma.team.findFirst.mockResolvedValue(mockTeam);
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "member-123",
      teamId: "team-123",
      userId: "user-456",
      role: "EDITOR",
    });
  });

  it("should return 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await PUT(createPutRequest({ role: "ADMIN" }), createParams());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 200 and update member role successfully", async () => {
    const updatedMember = {
      id: "member-123",
      teamId: "team-123",
      userId: "user-456",
      role: "ADMIN",
      joinedAt: new Date(),
      user: {
        id: "user-456",
        name: "Another User",
        email: "another@example.com",
        image: null,
      },
    };
    mockPrisma.teamMember.update.mockResolvedValue(updatedMember);

    const res = await PUT(createPutRequest({ role: "ADMIN" }), createParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.member).toMatchObject({
      id: "member-123",
      role: "ADMIN",
    });
    expect(mockPrisma.teamMember.update).toHaveBeenCalledWith({
      where: { id: "member-123" },
      data: { role: "ADMIN" },
      include: expect.any(Object),
    });
  });

  it("should return 403 when a non-owner tries to change roles", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-not-owner" },
    });
    mockPrisma.team.findFirst.mockResolvedValue({
      ...mockTeam,
      ownerId: "user-abc-123",
    });

    const res = await PUT(createPutRequest({ role: "ADMIN" }), createParams());
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Only the team owner can change member roles");
  });

  it("should return 400 when role is invalid", async () => {
    const res = await PUT(createPutRequest({ role: "INVALID" }), createParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("should return 400 when role is missing", async () => {
    const res = await PUT(createPutRequest({}), createParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("should return 400 when trying to change the owner role", async () => {
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      id: "member-owner",
      teamId: "team-123",
      userId: "user-abc-123",
      role: "OWNER",
    });

    const res = await PUT(createPutRequest({ role: "ADMIN" }), {
      params: Promise.resolve({ teamId: "team-123", memberId: "member-owner" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Cannot change the owner role");
  });

  it("should return 404 when member to update is not found", async () => {
    mockPrisma.teamMember.findUnique.mockResolvedValue(null);

    const res = await PUT(createPutRequest({ role: "ADMIN" }), createParams());
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Member not found");
  });
});
