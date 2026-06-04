/**
 * Tests for team-access middleware
 *
 * Tests withTeamAccess, canReview, and canSubmitForReview
 * Mocks prisma directly since the middleware does not use repositories
 */

import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    team: {
      findUnique: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { canReview, canSubmitForReview, withTeamAccess } from "@/lib/middleware/team-access";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockTeam = { ownerId: "owner-1" };
const mockMembership = (role: string) => ({ role });

function isNextResponse(val: unknown): val is NextResponse {
  return (
    val instanceof NextResponse || (typeof val === "object" && val !== null && "status" in val)
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("withTeamAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return team info for team owner (full access)", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);
    // No need to mock teamMember — owner check happens first

    const result = await withTeamAccess("owner-1", "team-1");

    expect(isNextResponse(result)).toBe(false);
    if (!isNextResponse(result)) {
      expect(result.teamId).toBe("team-1");
      expect(result.userId).toBe("owner-1");
      expect(result.role).toBe("OWNER");
    }
    expect(prisma.team.findUnique).toHaveBeenCalledWith({
      where: { id: "team-1" },
      select: { ownerId: true },
    });
    expect(prisma.teamMember.findFirst).not.toHaveBeenCalled();
  });

  it("should return team info for team member with matching role", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(mockMembership("EDITOR") as any);

    const result = await withTeamAccess("member-1", "team-1", ["EDITOR", "ADMIN"]);

    expect(isNextResponse(result)).toBe(false);
    if (!isNextResponse(result)) {
      expect(result.teamId).toBe("team-1");
      expect(result.userId).toBe("member-1");
      expect(result.role).toBe("EDITOR");
    }
  });

  it("should return 403 for non-member", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);

    const result = await withTeamAccess("stranger", "team-1");

    expect(isNextResponse(result)).toBe(true);
    if (isNextResponse(result)) {
      expect(result.status).toBe(403);
      const body = await result.json();
      expect(body.error).toContain("not a member");
    }
  });

  it("should return 403 when required role is not met", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(mockMembership("VIEWER") as any);

    const result = await withTeamAccess("viewer-1", "team-1", ["ADMIN", "EDITOR"]);

    expect(isNextResponse(result)).toBe(true);
    if (isNextResponse(result)) {
      expect(result.status).toBe(403);
      const body = await result.json();
      expect(body.error).toContain("ADMIN");
    }
  });

  it("should return 404 when team does not exist", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

    const result = await withTeamAccess("user-1", "nonexistent-team");

    expect(isNextResponse(result)).toBe(true);
    if (isNextResponse(result)) {
      expect(result.status).toBe(404);
      const body = await result.json();
      expect(body.code).toBe("NOT_FOUND");
    }
  });

  it("should allow any member when no requiredRoles specified", async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);
    vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(mockMembership("VIEWER") as any);

    const result = await withTeamAccess("viewer-1", "team-1");

    expect(isNextResponse(result)).toBe(false);
    if (!isNextResponse(result)) {
      expect(result.role).toBe("VIEWER");
    }
  });
});

describe("canReview", () => {
  it("should return true for OWNER", () => {
    expect(canReview("OWNER" as any)).toBe(true);
  });

  it("should return true for ADMIN", () => {
    expect(canReview("ADMIN" as any)).toBe(true);
  });

  it("should return false for EDITOR", () => {
    expect(canReview("EDITOR" as any)).toBe(false);
  });

  it("should return false for VIEWER", () => {
    expect(canReview("VIEWER" as any)).toBe(false);
  });
});

describe("canSubmitForReview", () => {
  it("should return true for OWNER", () => {
    expect(canSubmitForReview("OWNER" as any)).toBe(true);
  });

  it("should return true for ADMIN", () => {
    expect(canSubmitForReview("ADMIN" as any)).toBe(true);
  });

  it("should return true for EDITOR", () => {
    expect(canSubmitForReview("EDITOR" as any)).toBe(true);
  });

  it("should return false for VIEWER", () => {
    expect(canSubmitForReview("VIEWER" as any)).toBe(false);
  });
});
