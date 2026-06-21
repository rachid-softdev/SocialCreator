import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock variables (needed before vi.mock factories)
// ---------------------------------------------------------------------------
const mockPrisma = vi.hoisted(() => ({
  team: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  teamMember: {
    create: vi.fn(),
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
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createGetRequest() {
  return new NextRequest("http://localhost:3000/api/teams");
}

function createPostRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const mockTeam = {
  id: "team-1",
  name: "My Team",
  ownerId: "user-abc-123",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  owner: {
    id: "user-abc-123",
    name: "Test User",
    email: "test@example.com",
    image: null,
  },
  members: [
    {
      id: "tm-1",
      teamId: "team-1",
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
  ],
  _count: {
    profiles: 0,
    members: 1,
  },
};

// ---------------------------------------------------------------------------
// Tests: GET /api/teams
// ---------------------------------------------------------------------------
describe("GET /api/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
  });

  it("should return 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 200 with list of teams", async () => {
    mockPrisma.team.findMany.mockResolvedValue([mockTeam]);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.teams).toHaveLength(1);
    expect(data.teams[0].id).toBe("team-1");
    expect(data.teams[0].name).toBe("My Team");
    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ ownerId: "user-abc-123" }, { members: { some: { userId: "user-abc-123" } } }],
        },
      }),
    );
  });

  it("should return empty array when user has no teams", async () => {
    mockPrisma.team.findMany.mockResolvedValue([]);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.teams).toEqual([]);
  });

  it("should include owner, members, and _count in response", async () => {
    const teamWithDetails = {
      ...mockTeam,
      _count: { profiles: 3, members: 5 },
    };
    mockPrisma.team.findMany.mockResolvedValue([teamWithDetails]);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(data.teams[0].owner).toBeDefined();
    expect(data.teams[0].owner.email).toBe("test@example.com");
    expect(data.teams[0].members).toHaveLength(1);
    expect(data.teams[0]._count.profiles).toBe(3);
    expect(data.teams[0]._count.members).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/teams
// ---------------------------------------------------------------------------
describe("POST /api/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
  });

  it("should return 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(createPostRequest({ name: "My Team" }));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 201 and create a team with valid name", async () => {
    const createdTeam = {
      id: "team-new",
      name: "My Team",
      ownerId: "user-abc-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: {
        id: "user-abc-123",
        name: "Test User",
        email: "test@example.com",
        image: null,
      },
      members: [
        {
          id: "tm-new",
          teamId: "team-new",
          userId: "user-abc-123",
          role: "OWNER",
          joinedAt: new Date(),
          user: {
            id: "user-abc-123",
            name: "Test User",
            email: "test@example.com",
            image: null,
          },
        },
      ],
    };
    mockPrisma.team.create.mockResolvedValue(createdTeam);

    const res = await POST(createPostRequest({ name: "My Team" }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.team).toMatchObject({
      id: "team-new",
      name: "My Team",
      ownerId: "user-abc-123",
    });

    expect(prisma.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "My Team",
          ownerId: "user-abc-123",
          members: {
            create: {
              userId: "user-abc-123",
              role: "OWNER",
              joinedAt: expect.any(Date),
            },
          },
        }),
      }),
    );
  });

  it("should return 400 when name is empty", async () => {
    const res = await POST(createPostRequest({ name: "" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("should return 400 when name exceeds 100 characters", async () => {
    const res = await POST(createPostRequest({ name: "A".repeat(101) }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("should return 400 when name is missing", async () => {
    const res = await POST(createPostRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("should return 500 when Prisma create throws", async () => {
    mockPrisma.team.create.mockRejectedValue(new Error("DB error"));

    const res = await POST(createPostRequest({ name: "My Team" }));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
