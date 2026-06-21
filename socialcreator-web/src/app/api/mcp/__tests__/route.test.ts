import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock variables (needed before vi.mock factories)
// ---------------------------------------------------------------------------
const mockAuthenticateMcpRequest = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockGetIdentifier = vi.hoisted(() => vi.fn());

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    agentRun: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    profile: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../auth", () => ({
  authenticateMcpRequest: mockAuthenticateMcpRequest,
}));

vi.mock("@/lib/rate-limit-redis", () => ({
  checkRateLimit: mockCheckRateLimit,
  getIdentifier: mockGetIdentifier,
  withRateLimit: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { prisma } from "@/lib/prisma";
import { POST } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createJsonRpcRequest(body: unknown, apiKey?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }
  return new NextRequest("http://localhost:3000/api/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function validJsonRpc(method: string, params?: Record<string, unknown>) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method,
    params: params ?? {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/mcp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateMcpRequest.mockResolvedValue({
      userId: "user-abc-123",
      apiKeyId: "ak-123",
    });
    mockGetIdentifier.mockReturnValue("user:user-abc-123");
    mockCheckRateLimit.mockResolvedValue({ success: true, reset: 0 });
  });

  // -- Auth ---

  it("should return auth error when API key is missing", async () => {
    mockAuthenticateMcpRequest.mockResolvedValue(null);

    const req = createJsonRpcRequest(validJsonRpc("list_agents"));
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error.code).toBe(-32000);
    expect(data.error.message).toBe("Invalid or missing API key");
  });

  it("should return auth error when API key is invalid", async () => {
    mockAuthenticateMcpRequest.mockResolvedValue(null);

    const req = createJsonRpcRequest(validJsonRpc("list_agents"), "invalid_key");
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error.code).toBe(-32000);
  });

  // -- Rate limit ---

  it("should return 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({
      success: false,
      reset: Date.now() + 60000,
    });

    const req = createJsonRpcRequest(validJsonRpc("list_agents"), "valid_key");
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error.code).toBe(-32001);
    expect(data.error.message).toContain("Rate limit exceeded");
  });

  // -- JSON-RPC validation ---

  it("should return error for invalid JSON-RPC version", async () => {
    const req = createJsonRpcRequest({ jsonrpc: "1.0", id: 1, method: "list_agents" }, "valid_key");
    const res = await POST(req);
    const data = await res.json();

    expect(data.error.code).toBe(-32600);
    expect(data.error.message).toContain("Invalid JSON-RPC version");
  });

  it("should return error when method is missing", async () => {
    const req = createJsonRpcRequest({ jsonrpc: "2.0", id: 1 }, "valid_key");
    const res = await POST(req);
    const data = await res.json();

    expect(data.error.code).toBe(-32600);
    expect(data.error.message).toContain("Method is required");
  });

  // -- Method routing ---

  it("should return error for unknown method", async () => {
    const req = createJsonRpcRequest(validJsonRpc("unknown_method"), "valid_key");
    const res = await POST(req);
    const data = await res.json();

    expect(data.error.code).toBe(-32601);
    expect(data.error.message).toContain("Method 'unknown_method' not found");
  });

  // -- list_agents ---

  it("should handle list_agents and return agents list", async () => {
    const mockAgents = [
      { id: "agent-1", name: "Agent 1", type: "TEXT_POST", platforms: ["X"], isActive: true },
    ];
    (prisma.agent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgents);

    const req = createJsonRpcRequest(validJsonRpc("list_agents"), "valid_key");
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toEqual({ agents: mockAgents });
    expect(prisma.agent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profile: { userId: "user-abc-123" } },
      }),
    );
  });

  it("should handle list_agents with profile_id filter", async () => {
    (prisma.agent.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const req = createJsonRpcRequest(
      validJsonRpc("list_agents", { profile_id: "profile-123" }),
      "valid_key",
    );
    const res = await POST(req);
    await res.json();

    expect(prisma.agent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: "profile-123", profile: { userId: "user-abc-123" } },
      }),
    );
  });

  // -- list_profiles ---

  it("should handle list_profiles and return profiles list", async () => {
    const mockProfiles = [
      { id: "profile-1", name: "Profile 1", platforms: ["X"], createdAt: new Date() },
    ];
    (prisma.profile.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockProfiles,
    );

    const req = createJsonRpcRequest(validJsonRpc("list_profiles"), "valid_key");
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toMatchObject({
      profiles: [{ id: "profile-1", name: "Profile 1", platforms: ["X"] }],
    });
  });

  // -- create_agent ---

  it("should handle create_agent and create a new agent", async () => {
    (prisma.profile.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "profile-abc",
      userId: "user-abc-123",
    });
    (prisma.agent.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-new",
    });

    const req = createJsonRpcRequest(
      validJsonRpc("create_agent", {
        profile_id: "profile-abc",
        name: "New Agent",
        type: "TEXT_POST",
        platforms: ["X"],
      }),
      "valid_key",
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toEqual({ agent_id: "agent-new" });
  });

  it("should return internal error for create_agent when profile not found", async () => {
    (prisma.profile.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = createJsonRpcRequest(
      validJsonRpc("create_agent", {
        profile_id: "profile-unknown",
        name: "New Agent",
        type: "TEXT_POST",
        platforms: ["X"],
      }),
      "valid_key",
    );
    const res = await POST(req);
    const data = await res.json();

    expect(data.error).toBeDefined();
    expect(data.error.message).toBe("Internal server error");
  });

  // -- run_agent ---

  it("should handle run_agent and create a pending run", async () => {
    (prisma.agent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      profileId: "profile-abc",
      profile: { userId: "user-abc-123" },
    });
    (prisma.agentRun.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.agentRun.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "run-1",
      status: "PENDING",
    });

    const req = createJsonRpcRequest(
      validJsonRpc("run_agent", { agent_id: "agent-1", brief: "Create a post about AI" }),
      "valid_key",
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.result).toEqual({ run_id: "run-1", status: "PENDING" });
  });

  it("should return internal error for run_agent when agent not found", async () => {
    (prisma.agent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = createJsonRpcRequest(
      validJsonRpc("run_agent", { agent_id: "agent-unknown", brief: "Create a post" }),
      "valid_key",
    );
    const res = await POST(req);
    const data = await res.json();

    expect(data.error).toBeDefined();
    expect(data.error.message).toBe("Internal server error");
  });

  it("should return error for run_agent when agent is already running", async () => {
    (prisma.agent.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "agent-1",
      profileId: "profile-abc",
      profile: { userId: "user-abc-123" },
    });
    (prisma.agentRun.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "run-existing",
      status: "RUNNING",
    });

    const req = createJsonRpcRequest(
      validJsonRpc("run_agent", { agent_id: "agent-1", brief: "Create a post" }),
      "valid_key",
    );
    const res = await POST(req);
    const data = await res.json();

    expect(data.error).toBeDefined();
    expect(data.error.message).toBe("Internal server error");
  });
});
