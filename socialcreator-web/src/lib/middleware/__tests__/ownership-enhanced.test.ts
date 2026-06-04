/**
 * Tests for ownership-enhanced access checks
 *
 * Tests verifyProfileAccess and verifyContentAccess
 * These functions check direct ownership first, then team membership
 */

import type { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
    generatedContent: {
      findUnique: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { verifyContentAccess, verifyProfileAccess } from "@/lib/middleware/ownership";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockProfile = (overrides: Record<string, unknown> = {}) => ({
  id: "profile-1",
  userId: "user-1",
  name: "Test Profile",
  teamId: null,
  ...overrides,
});

function isErrorResult(result: any): result is { valid: false; error: NextResponse } {
  return result.valid === false;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("verifyProfileAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should pass for direct owner", async () => {
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile() as any);

    const result = await verifyProfileAccess("user-1", "profile-1");

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.id).toBe("profile-1");
    }
  });

  it("should pass for team member with EDITOR+ role via teamId", async () => {
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(
      mockProfile({ teamId: "team-1" }) as any,
    );
    vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
      role: "EDITOR",
    } as any);

    const result = await verifyProfileAccess("member-1", "profile-1");

    expect(result.valid).toBe(true);
    expect(prisma.teamMember.findFirst).toHaveBeenCalledWith({
      where: {
        teamId: "team-1",
        userId: "member-1",
        role: { in: ["OWNER", "ADMIN", "EDITOR"] },
      },
    });
  });

  it("should pass for team owner (even without explicit membership)", async () => {
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(
      mockProfile({ teamId: "team-1" }) as any,
    );
    // No membership
    vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: "team-1",
      ownerId: "owner-1",
    } as any);

    const result = await verifyProfileAccess("owner-1", "profile-1");

    expect(result.valid).toBe(true);
  });

  it("should fail for non-member when profile has teamId", async () => {
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(
      mockProfile({ teamId: "team-1" }) as any,
    );
    vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: "team-1",
      ownerId: "owner-1",
    } as any);

    const result = await verifyProfileAccess("stranger", "profile-1");

    expect(result.valid).toBe(false);
    if (isErrorResult(result)) {
      expect(result.error.status).toBe(403);
      const body = await result.error.json();
      expect(body.error).toContain("don't have access");
    }
  });

  it("should fail for non-owner when profile has no teamId", async () => {
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile({ teamId: null }) as any);

    const result = await verifyProfileAccess("stranger", "profile-1");

    expect(result.valid).toBe(false);
    if (isErrorResult(result)) {
      expect(result.error.status).toBe(403);
    }
  });

  it("should fail with notFound when profile does not exist", async () => {
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);

    const result = await verifyProfileAccess("user-1", "nonexistent");

    expect(result.valid).toBe(false);
    if (isErrorResult(result)) {
      expect(result.error.status).toBe(404);
    }
  });
});

describe("verifyContentAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should pass for direct owner via profile check", async () => {
    vi.mocked(prisma.generatedContent.findUnique).mockResolvedValue({
      id: "content-1",
      profileId: "profile-1",
      profile: { userId: "user-1" },
    } as any);
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(mockProfile() as any);

    const result = await verifyContentAccess("user-1", "content-1");

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.id).toBe("content-1");
    }
  });

  it("should pass for team member with access to the profile", async () => {
    vi.mocked(prisma.generatedContent.findUnique).mockResolvedValue({
      id: "content-1",
      profileId: "profile-1",
      profile: { userId: "other-user", teamId: "team-1" },
    } as any);
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(
      mockProfile({ userId: "other-user", teamId: "team-1" }) as any,
    );
    vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
      role: "EDITOR",
    } as any);

    const result = await verifyContentAccess("member-1", "content-1");

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.id).toBe("content-1");
    }
  });

  it("should fail when content does not exist", async () => {
    vi.mocked(prisma.generatedContent.findUnique).mockResolvedValue(null);

    const result = await verifyContentAccess("user-1", "nonexistent");

    expect(result.valid).toBe(false);
    if (isErrorResult(result)) {
      expect(result.error.status).toBe(404);
    }
  });

  it("should fail when user is not owner and not a team member", async () => {
    vi.mocked(prisma.generatedContent.findUnique).mockResolvedValue({
      id: "content-1",
      profileId: "profile-1",
      profile: { userId: "other-user", teamId: "team-1" },
    } as any);
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(
      mockProfile({ userId: "other-user", teamId: "team-1" }) as any,
    );
    vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: "team-1",
      ownerId: "owner-1",
    } as any);

    const result = await verifyContentAccess("stranger", "content-1");

    expect(result.valid).toBe(false);
    if (isErrorResult(result)) {
      expect(result.error.status).toBe(404);
      const body = await result.error.json();
      expect(body.error).toContain("Content not found");
    }
  });
});
