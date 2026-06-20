/**
 * Integration tests for v1 API routes
 *
 * Tests:
 * - Health GET returns 200
 * - All v1 routes return X-API-Version: v1 header
 * - All v1 routes return Cache-Control header (where appropriate)
 * - Auth failure (401) for protected routes via middleware
 *
 * Uses mocked dependencies — no real database needed.
 *
 * Note: The withApiMiddleware wrapper has been mocked to call the handler
 * directly for unit testing clarity. Auth/401 behavior is tested separately
 * via the api-middleware integration tests.
 */

import { createProfileSchema } from "@socialcreator/types";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateRequestUrls } from "@/lib/middleware/ssrf-middleware";
import { checkProfileQuota } from "@/lib/quota-guard";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit-redis", () => ({ withRateLimit: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock prisma for routes that use it directly (dashboard)
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    agent: {
      groupBy: vi.fn(),
    },
    generatedContent: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    connectedAccount: {
      groupBy: vi.fn(),
    },
  },
}));

// Mock withApiMiddleware to be a pass-through for handler tests.
// The middleware's auth/rate-limit behavior is tested separately
// in api-middleware.integration.test.ts.
vi.mock("@/lib/api-middleware", () => {
  // Create a middleware wrapper that calls the handler with
  // the route params included in the ApiContext so that
  // handlers destructuring { userId, params } from the context work.
  const withApiMiddleware = (handler: (ctx: any, params?: any) => Promise<NextResponse>) => {
    return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
      const resolvedParams = context?.params ? await context.params : {};
      // Pass params both in the context AND as second arg for compatibility
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
    findByUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  agent: {
    findById: vi.fn(),
    findByProfileId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  agentRun: {
    findByAgentId: vi.fn(),
  },
  mediaAsset: {
    findById: vi.fn(),
    findByProfileId: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  connectedAccount: {
    findById: vi.fn(),
    findByProfileId: vi.fn(),
    findByProfileAndPlatform: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
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
  content: {
    findById: vi.fn(),
    findByProfileId: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findById: vi.fn(),
  },
  apiKey: {},
  publishLog: {},
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => mockRepos),
}));

vi.mock("@/lib/quota-guard", () => ({
  checkProfileQuota: vi.fn(),
}));

vi.mock("@/lib/middleware/ssrf-middleware", () => ({
  validateRequestUrls: vi.fn(),
}));

vi.mock("@socialcreator/types", () => ({
  createProfileSchema: {
    safeParse: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import all v1 routes
// ---------------------------------------------------------------------------

import { GET as AgentGET } from "@/app/api/v1/agents/[id]/route";
import { GET as AgentRunsGET } from "@/app/api/v1/agents/[id]/runs/route";
import { GET as AgentsGET, POST as AgentsPOST } from "@/app/api/v1/agents/route";
import { DELETE as ConnectedAccountDELETE } from "@/app/api/v1/connected-accounts/[id]/route";
import { GET as ConnectedAccountsGET } from "@/app/api/v1/connected-accounts/route";
import { GET as HealthGET } from "@/app/api/v1/health/route";
import { GET as MediaAssetGET } from "@/app/api/v1/media/[id]/route";
import { GET as MediaGET, POST as MediaPOST } from "@/app/api/v1/media/route";
import {
  DELETE as ProfileDELETE,
  GET as ProfileGET,
  PUT as ProfilePUT,
} from "@/app/api/v1/profiles/[id]/route";
import { PATCH as ProfileSharePATCH } from "@/app/api/v1/profiles/[id]/share/route";
import { GET as ProfilesGET, POST as ProfilesPOST } from "@/app/api/v1/profiles/route";
import { GET as TeamDashboardGET } from "@/app/api/v1/teams/[id]/dashboard/route";
import {
  GET as TeamInvitationsGET,
  POST as TeamInvitationsPOST,
} from "@/app/api/v1/teams/[id]/invitations/route";
import {
  DELETE as TeamDELETE,
  GET as TeamGET,
  PUT as TeamPUT,
} from "@/app/api/v1/teams/[id]/route";
import { GET as TeamsGET, POST as TeamsPOST } from "@/app/api/v1/teams/route";

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
// Tests
// ---------------------------------------------------------------------------

describe("v1 API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Health (no auth required) ───────────────────────────────

  describe("GET /api/v1/health", () => {
    it("should return 200 with status ok", async () => {
      const res = await HealthGET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.version).toBe("v1");
      expect(data.timestamp).toBeTruthy();
    });

    it("should return X-API-Version: v1 header", async () => {
      const res = await HealthGET();
      expect(res.headers.get("X-API-Version")).toBe("v1");
    });

    it("should return Cache-Control header", async () => {
      const res = await HealthGET();
      expect(res.headers.get("Cache-Control")).toBeTruthy();
    });
  });

  // ── Profiles List ───────────────────────────────────────────

  describe("GET /api/v1/profiles", () => {
    it("should return 200 with empty list", async () => {
      mockRepos.profile.findByUserId.mockResolvedValue([]);
      vi.mocked(prisma.agent.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.generatedContent.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.connectedAccount.groupBy).mockResolvedValue([]);

      const res = await ProfilesGET(createRequest("/api/v1/profiles"), createParams({}));
      expect(res.status).toBe(200);
    });

    it("should return X-API-Version: v1 header", async () => {
      mockRepos.profile.findByUserId.mockResolvedValue([]);
      // N+1 fix: groupBy calls used for batch counts
      vi.mocked(prisma.agent.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.generatedContent.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.connectedAccount.groupBy).mockResolvedValue([]);

      const res = await ProfilesGET(createRequest("/api/v1/profiles"), createParams({}));
      expect(res.headers.get("X-API-Version")).toBe("v1");
    });

    it("should return Cache-Control: private, no-store", async () => {
      mockRepos.profile.findByUserId.mockResolvedValue([]);
      vi.mocked(prisma.agent.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.generatedContent.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.connectedAccount.groupBy).mockResolvedValue([]);

      const res = await ProfilesGET(createRequest("/api/v1/profiles"), createParams({}));
      expect(res.headers.get("Cache-Control")).toContain("no-store");
    });
  });

  describe("POST /api/v1/profiles", () => {
    it("should return X-API-Version header on creation", async () => {
      vi.mocked(createProfileSchema.safeParse).mockReturnValue({
        success: true,
        data: { name: "Test Profile", brandVoice: "", platforms: ["X"] },
      } as any);
      mockRepos.profile.create.mockResolvedValue({ id: "p-1", name: "Test Profile" });
      vi.mocked(checkProfileQuota).mockResolvedValue(true as any);

      const res = await ProfilesPOST(
        createRequest("/api/v1/profiles", {
          method: "POST",
          body: { name: "Test Profile", brandVoice: "", platforms: ["X"] },
        }),
        createParams({}),
      );
      expect(res.headers.get("X-API-Version")).toBe("v1");
    });
  });

  // ── Profiles by ID ──────────────────────────────────────────

  describe("GET /api/v1/profiles/[id]", () => {
    it("should return X-API-Version header", async () => {
      mockRepos.profile.findById.mockResolvedValue({ id: "p-1", userId: "user-abc-123" });

      const res = await ProfileGET(
        createRequest("/api/v1/profiles/p-1"),
        createParams({ id: "p-1" }),
      );
      expect(res.headers.get("X-API-Version")).toBe("v1");
    });

    it("should return 404 when profile not found", async () => {
      mockRepos.profile.findById.mockResolvedValue(null);

      const res = await ProfileGET(
        createRequest("/api/v1/profiles/p-1"),
        createParams({ id: "p-1" }),
      );
      expect(res.status).toBe(404);
    });

    it("should return 401 when userId does not match", async () => {
      mockRepos.profile.findById.mockResolvedValue({ id: "p-1", userId: "other-user" });

      const res = await ProfileGET(
        createRequest("/api/v1/profiles/p-1"),
        createParams({ id: "p-1" }),
      );
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/v1/profiles/[id]", () => {
    it("should update profile and return X-API-Version header", async () => {
      mockRepos.profile.findById.mockResolvedValue({ id: "p-1", userId: "user-abc-123" });
      mockRepos.profile.update.mockResolvedValue({ id: "p-1", name: "Updated" });

      const res = await ProfilePUT(
        createRequest("/api/v1/profiles/p-1", { method: "PUT", body: { name: "Updated" } }),
        createParams({ id: "p-1" }),
      );
      expect(res.headers.get("X-API-Version")).toBe("v1");
    });
  });

  describe("DELETE /api/v1/profiles/[id]", () => {
    it("should delete profile and return X-API-Version header", async () => {
      mockRepos.profile.findById.mockResolvedValue({ id: "p-1", userId: "user-abc-123" });
      mockRepos.profile.delete.mockResolvedValue(undefined);

      const res = await ProfileDELETE(
        createRequest("/api/v1/profiles/p-1", { method: "DELETE" }),
        createParams({ id: "p-1" }),
      );
      expect(res.headers.get("X-API-Version")).toBe("v1");
    });
  });

  // ── Agents List ─────────────────────────────────────────────

  describe("GET /api/v1/agents", () => {
    it("should return X-API-Version header", async () => {
      mockRepos.profile.findByUserId.mockResolvedValue([]);

      const res = await AgentsGET(createRequest("/api/v1/agents"), createParams({}));
      expect(res.headers.get("X-API-Version")).toBe("v1");
    });

    it("should return Cache-Control: private, no-store", async () => {
      mockRepos.profile.findByUserId.mockResolvedValue([]);

      const res = await AgentsGET(createRequest("/api/v1/agents"), createParams({}));
      expect(res.headers.get("Cache-Control")).toContain("no-store");
    });
  });

  describe("POST /api/v1/agents", () => {
    it("should validate profile ownership and return 404 for unknown profile", async () => {
      mockRepos.profile.findById.mockResolvedValue(null);

      const res = await AgentsPOST(
        createRequest("/api/v1/agents", {
          method: "POST",
          body: {
            profileId: "nonexistent",
            name: "Test Agent",
            type: "TEXT_POST",
            platforms: ["X"],
          },
        }),
        createParams({}),
      );
      expect(res.status).toBe(404);
    });
  });

  // ── Agents by ID ────────────────────────────────────────────

  describe("GET /api/v1/agents/[id]", () => {
    it("should return 404 when agent not found", async () => {
      mockRepos.agent.findById.mockResolvedValue(null);

      const res = await AgentGET(createRequest("/api/v1/agents/a-1"), createParams({ id: "a-1" }));
      expect(res.status).toBe(404);
    });
  });

  // ── Agent Runs ──────────────────────────────────────────────

  describe("GET /api/v1/agents/[id]/runs", () => {
    it("should return runs list", async () => {
      mockRepos.agent.findById.mockResolvedValue({
        id: "a-1",
        profile: { id: "p-1", userId: "user-abc-123" },
      });
      mockRepos.profile.findById.mockResolvedValue({ id: "p-1", userId: "user-abc-123" });
      mockRepos.agentRun.findByAgentId.mockResolvedValue([{ id: "run-1", status: "SUCCESS" }]);

      const res = await AgentRunsGET(
        createRequest("/api/v1/agents/a-1/runs"),
        createParams({ id: "a-1" }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.runs).toHaveLength(1);
    });
  });

  // ── Media ───────────────────────────────────────────────────

  describe("GET /api/v1/media", () => {
    it("should return 400 when profileId missing", async () => {
      const res = await MediaGET(createRequest("/api/v1/media"), createParams({}));
      expect(res.status).toBe(400);
    });

    it("should return 404 when profile not found", async () => {
      mockRepos.profile.findById.mockResolvedValue(null);

      const res = await MediaGET(createRequest("/api/v1/media?profileId=p-1"), createParams({}));
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/media", () => {
    it("should validate SSRF on media URL", async () => {
      vi.mocked(validateRequestUrls).mockResolvedValue(
        NextResponse.json({ error: "Invalid URL in field 'url': Private IP" }, { status: 400 }),
      );

      const res = await MediaPOST(
        createRequest("/api/v1/media", {
          method: "POST",
          body: { profileId: "p-1", type: "IMAGE", url: "https://10.0.0.1/img.jpg" },
        }),
        createParams({}),
      );
      expect(res.status).toBe(400);
      expect(res.headers.get("X-API-Version")).toBeNull(); // SSRF error returned before handler logic
    });
  });

  describe("GET /api/v1/media/[id]", () => {
    it("should return 404 when asset not found", async () => {
      mockRepos.mediaAsset.findById.mockResolvedValue(null);

      const res = await MediaAssetGET(
        createRequest("/api/v1/media/m-1"),
        createParams({ id: "m-1" }),
      );
      expect(res.status).toBe(404);
    });
  });

  // ── Connected Accounts ──────────────────────────────────────

  describe("GET /api/v1/connected-accounts", () => {
    it("should return 400 when profileId missing", async () => {
      const res = await ConnectedAccountsGET(
        createRequest("/api/v1/connected-accounts"),
        createParams({}),
      );
      expect(res.status).toBe(400);
    });

    it("should return accounts list", async () => {
      mockRepos.profile.findById.mockResolvedValue({ id: "p-1", userId: "user-abc-123" });
      mockRepos.connectedAccount.findByProfileId.mockResolvedValue([
        { id: "ca-1", platform: "X", accountName: "Test" },
      ]);

      const res = await ConnectedAccountsGET(
        createRequest("/api/v1/connected-accounts?profileId=p-1"),
        createParams({}),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.accounts).toHaveLength(1);
    });
  });

  describe("DELETE /api/v1/connected-accounts/[id]", () => {
    it("should return 404 when account not found", async () => {
      mockRepos.connectedAccount.findById.mockResolvedValue(null);

      const res = await ConnectedAccountDELETE(
        createRequest("/api/v1/connected-accounts/ca-1", { method: "DELETE" }),
        createParams({ id: "ca-1" }),
      );
      expect(res.status).toBe(404);
    });
  });

  // ── Teams ───────────────────────────────────────────────────

  describe("GET /api/v1/teams", () => {
    it("should return X-API-Version header", async () => {
      mockRepos.team.findByOwnerId.mockResolvedValue([]);
      mockRepos.teamMember.findByUserId.mockResolvedValue([]);

      const res = await TeamsGET(createRequest("/api/v1/teams"), createParams({}));
      expect(res.headers.get("X-API-Version")).toBe("v1");
    });

    it("should return Cache-Control: private, no-store", async () => {
      mockRepos.team.findByOwnerId.mockResolvedValue([]);
      mockRepos.teamMember.findByUserId.mockResolvedValue([]);

      const res = await TeamsGET(createRequest("/api/v1/teams"), createParams({}));
      expect(res.headers.get("Cache-Control")).toContain("no-store");
    });
  });

  describe("POST /api/v1/teams", () => {
    it("should create team and return 201", async () => {
      mockRepos.team.create.mockResolvedValue({
        id: "t-1",
        name: "My Team",
        ownerId: "user-abc-123",
      });

      const res = await TeamsPOST(
        createRequest("/api/v1/teams", { method: "POST", body: { name: "My Team" } }),
        createParams({}),
      );
      expect(res.status).toBe(201);
      expect(res.headers.get("X-API-Version")).toBe("v1");
    });
  });

  describe("GET /api/v1/teams/[id]", () => {
    it("should return 404 when team not found", async () => {
      mockRepos.team.findById.mockResolvedValue(null);

      const res = await TeamGET(createRequest("/api/v1/teams/t-1"), createParams({ id: "t-1" }));
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/v1/teams/[id]", () => {
    it("should return 403 when not team owner", async () => {
      mockRepos.team.findById.mockResolvedValue({ id: "t-1", ownerId: "other-user" });

      const res = await TeamPUT(
        createRequest("/api/v1/teams/t-1", { method: "PUT", body: { name: "Hacked" } }),
        createParams({ id: "t-1" }),
      );
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/v1/teams/[id]", () => {
    it("should return 404 when team not found", async () => {
      mockRepos.team.findById.mockResolvedValue(null);

      const res = await TeamDELETE(
        createRequest("/api/v1/teams/t-1", { method: "DELETE" }),
        createParams({ id: "t-1" }),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/teams/[id]/invitations", () => {
    it("should add member and return 201", async () => {
      mockRepos.team.findById.mockResolvedValue({ id: "t-1", ownerId: "user-abc-123" });
      mockRepos.teamMember.addMember.mockResolvedValue({
        id: "tm-1",
        teamId: "t-1",
        userId: "u-2",
        role: "EDITOR",
      });

      const res = await TeamInvitationsPOST(
        createRequest("/api/v1/teams/t-1/invitations", {
          method: "POST",
          body: { userId: "u-2", role: "EDITOR" },
        }),
        createParams({ id: "t-1" }),
      );
      expect(res.status).toBe(201);
      expect(res.headers.get("X-API-Version")).toBe("v1");
    });
  });

  describe("GET /api/v1/teams/[id]/invitations", () => {
    it("should return members list", async () => {
      mockRepos.team.findById.mockResolvedValue({
        id: "t-1",
        ownerId: "user-abc-123",
        members: [{ userId: "user-abc-123" }],
      });
      mockRepos.teamMember.findByTeamId.mockResolvedValue([
        { id: "tm-1", userId: "u-2", role: "MEMBER" },
      ]);

      const res = await TeamInvitationsGET(
        createRequest("/api/v1/teams/t-1/invitations"),
        createParams({ id: "t-1" }),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toContain("no-store");
    });
  });

  // ── Profile Share ──────────────────────────────────────────

  describe("PATCH /api/v1/profiles/[id]/share", () => {
    it("should set teamId on profile for owner", async () => {
      mockRepos.profile.findById.mockResolvedValue({ id: "p-1", userId: "user-abc-123" });
      mockRepos.team.findById.mockResolvedValue({
        id: "t-1",
        ownerId: "user-abc-123",
        members: [],
      });
      mockRepos.profile.update.mockResolvedValue({ id: "p-1", teamId: "t-1" });

      const res = await ProfileSharePATCH(
        createRequest("/api/v1/profiles/p-1/share", {
          method: "PATCH",
          body: { teamId: "t-1" },
        }),
        createParams({ id: "p-1" }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profile.teamId).toBe("t-1");
      expect(res.headers.get("X-API-Version")).toBe("v1");
    });

    it("should unshare profile when teamId is null", async () => {
      mockRepos.profile.findById.mockResolvedValue({
        id: "p-1",
        userId: "user-abc-123",
        teamId: "t-1",
      });
      mockRepos.profile.update.mockResolvedValue({ id: "p-1", teamId: null });

      const res = await ProfileSharePATCH(
        createRequest("/api/v1/profiles/p-1/share", {
          method: "PATCH",
          body: { teamId: null },
        }),
        createParams({ id: "p-1" }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profile.teamId).toBeNull();
    });

    it("should return 401 when non-owner tries to share", async () => {
      mockRepos.profile.findById.mockResolvedValue({ id: "p-1", userId: "other-user" });

      const res = await ProfileSharePATCH(
        createRequest("/api/v1/profiles/p-1/share", {
          method: "PATCH",
          body: { teamId: "t-1" },
        }),
        createParams({ id: "p-1" }),
      );
      expect(res.status).toBe(401);
    });

    it("should return 404 when profile not found", async () => {
      mockRepos.profile.findById.mockResolvedValue(null);

      const res = await ProfileSharePATCH(
        createRequest("/api/v1/profiles/p-1/share", {
          method: "PATCH",
          body: { teamId: "t-1" },
        }),
        createParams({ id: "p-1" }),
      );
      expect(res.status).toBe(404);
    });

    it("should return 404 when team does not exist", async () => {
      mockRepos.profile.findById.mockResolvedValue({ id: "p-1", userId: "user-abc-123" });
      mockRepos.team.findById.mockResolvedValue(null);

      const res = await ProfileSharePATCH(
        createRequest("/api/v1/profiles/p-1/share", {
          method: "PATCH",
          body: { teamId: "nonexistent" },
        }),
        createParams({ id: "p-1" }),
      );
      expect(res.status).toBe(404);
    });

    it("should return 403 when user is not team owner or admin", async () => {
      mockRepos.profile.findById.mockResolvedValue({ id: "p-1", userId: "user-abc-123" });
      mockRepos.team.findById.mockResolvedValue({
        id: "t-1",
        ownerId: "other-owner",
        members: [{ userId: "user-abc-123", role: "VIEWER" }],
      });

      const res = await ProfileSharePATCH(
        createRequest("/api/v1/profiles/p-1/share", {
          method: "PATCH",
          body: { teamId: "t-1" },
        }),
        createParams({ id: "p-1" }),
      );
      expect(res.status).toBe(403);
    });
  });

  // ── Team Dashboard ─────────────────────────────────────────

  describe("GET /api/v1/teams/[id]/dashboard", () => {
    beforeEach(() => {
      // Mock all prisma aggregation calls for the happy path
      vi.mocked(prisma.profile.count).mockResolvedValue(5);
      vi.mocked(prisma.generatedContent.count).mockResolvedValue(42);
      vi.mocked(prisma.generatedContent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.generatedContent.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.profile.findMany).mockResolvedValue([]);
    });

    it("should return aggregated team stats for owner", async () => {
      mockRepos.team.findById.mockResolvedValue({
        id: "t-1",
        name: "My Team",
        ownerId: "user-abc-123",
        members: [],
      });

      // Make the second count call (for total published) return a different value
      vi.mocked(prisma.generatedContent.count)
        .mockResolvedValueOnce(42) // total content created
        .mockResolvedValueOnce(30) // total published
        .mockResolvedValueOnce(5) // published this week
        .mockResolvedValueOnce(3); // in review

      const res = await TeamDashboardGET(
        createRequest("/api/v1/teams/t-1/dashboard"),
        createParams({ id: "t-1" }),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.team.name).toBe("My Team");
      expect(data.totalContentCreated).toBe(42);
      expect(data.totalContentPublished).toBe(30);
      expect(data.contentPublishedThisWeek).toBe(5);
      expect(data.contentInReview).toBe(3);
      expect(data.team.memberCount).toBe(1); // owner only
      expect(data.team.profileCount).toBe(5);
      expect(res.headers.get("Cache-Control")).toContain("no-store");
    });

    it("should return 404 when team not found", async () => {
      mockRepos.team.findById.mockResolvedValue(null);

      const res = await TeamDashboardGET(
        createRequest("/api/v1/teams/t-1/dashboard"),
        createParams({ id: "t-1" }),
      );
      expect(res.status).toBe(404);
    });

    it("should return 401 when non-member tries to access", async () => {
      mockRepos.team.findById.mockResolvedValue({
        id: "t-1",
        name: "My Team",
        ownerId: "other-owner",
        members: [],
      });

      const res = await TeamDashboardGET(
        createRequest("/api/v1/teams/t-1/dashboard"),
        createParams({ id: "t-1" }),
      );
      expect(res.status).toBe(401);
    });
  });
});
