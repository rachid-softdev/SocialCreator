import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock middleware dependencies (withApiMiddleware chain)
// ---------------------------------------------------------------------------
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit-redis", () => ({ withRateLimit: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock Prisma delegate methods used by the agents route
vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: { findFirst: vi.fn() },
    agent: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    agentRun: {
      count: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withRateLimit } from "@/lib/rate-limit-redis";
import { GET, POST } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createGetRequest(url?: string) {
  return new NextRequest(url ?? "http://localhost:3000/api/agents");
}

function createPostRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("GET /api/agents", () => {
  const mockAgent = {
    id: "agent-1",
    profileId: "profile-abc-123",
    name: "Content Bot",
    type: "TEXT_POST",
    platforms: ["X"],
    scheduleCron: null,
    autoPublish: false,
    maxPerDay: 2,
    isActive: true,
    config: {},
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    profile: { id: "profile-abc-123", name: "My Profile" },
    _count: { runs: 5 },
    runs: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
    (withRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it("should return 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 200 with user agents", async () => {
    (prisma.agent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockAgent]);
    (prisma.agentRun.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.agents).toHaveLength(1);
    expect(data.agents[0]).toMatchObject({
      id: "agent-1",
      name: "Content Bot",
    });
    expect(prisma.agent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profile: { userId: "user-abc-123" } },
      }),
    );
  });

  it("should return empty array when no agents exist", async () => {
    (prisma.agent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.agents).toEqual([]);
  });

  it("should filter agents by profileId query param", async () => {
    (prisma.agent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([mockAgent]);
    (prisma.agentRun.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const res = await GET(createGetRequest("http://localhost:3000/api/agents?profileId=profile-abc-123"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.agents).toHaveLength(1);
    expect(prisma.agent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: "profile-abc-123", profile: { userId: "user-abc-123" } },
      }),
    );
  });
});

describe("POST /api/agents", () => {
  const validAgentBody = {
    profileId: "profile-abc-123",
    name: "My Agent",
    type: "TEXT_POST" as const,
    platforms: ["X" as const],
  };

  const mockCreatedAgent = {
    id: "agent-new",
    profileId: "profile-abc-123",
    name: "My Agent",
    type: "TEXT_POST",
    platforms: ["X"],
    scheduleCron: null,
    autoPublish: false,
    maxPerDay: 2,
    isActive: true,
    config: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: { id: "profile-abc-123", name: "My Profile" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-abc-123" },
    });
    (withRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it("should return 401 when unauthenticated", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(createPostRequest(validAgentBody));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 with invalid body (missing name)", async () => {
    const res = await POST(createPostRequest({ profileId: "profile-abc-123", type: "TEXT_POST", platforms: ["X"] }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeTruthy();
  });

  it("should return 404 when profile not found (ownership check)", async () => {
    (prisma.profile.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(createPostRequest(validAgentBody));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("Profile not found");
  });

  it("should return 201 and create an agent", async () => {
    (prisma.profile.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "profile-abc-123",
      userId: "user-abc-123",
    });
    (prisma.agent.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreatedAgent);

    const res = await POST(createPostRequest(validAgentBody));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.agent).toMatchObject({
      name: "My Agent",
      profileId: "profile-abc-123",
    });
    expect(prisma.agent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "My Agent",
          profileId: "profile-abc-123",
        }),
      }),
    );
  });
});
