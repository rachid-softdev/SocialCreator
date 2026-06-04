/**
 * Ownership validation utilities
 *
 * Functions to verify that a user has ownership of the resources they are
 * trying to access.
 */

import type { Prisma, TeamRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { forbidden, notFound } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateOwnershipInput(userId: string, resourceId: string): NextResponse | null {
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resourceId || typeof resourceId !== "string") {
    return NextResponse.json({ error: "Resource not found or access denied" }, { status: 404 });
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ownership result types
// ---------------------------------------------------------------------------

type OwnershipResultSuccess<T> = { valid: true; data: T };
type OwnershipResultError = { valid: false; error: NextResponse };
type OwnershipResult<T> = OwnershipResultSuccess<T> | OwnershipResultError;

// Prisma GetPayload helpers
type ProfileResult = Prisma.ProfileGetPayload<Record<string, never>>;
type AgentWithProfile = Prisma.AgentGetPayload<{ include: { profile: true } }>;
type ContentWithProfile = Prisma.GeneratedContentGetPayload<{
  include: { profile: true };
}>;
type AccountWithProfile = Prisma.ConnectedAccountGetPayload<{
  include: { profile: true };
}>;
type VideoAssetResult = Prisma.VideoAssetGetPayload<Record<string, never>>;
type AgentRunWithAgentProfile = Prisma.AgentRunGetPayload<{
  include: { agent: { include: { profile: true } } };
}>;
type MediaAssetResult = Prisma.MediaAssetGetPayload<Record<string, never>>;
type ApiKeyResult = Prisma.ApiKeyGetPayload<Record<string, never>>;

// ---------------------------------------------------------------------------
// Ownership verification functions
// ---------------------------------------------------------------------------

/**
 * Verify that the user owns a profile
 */
export async function verifyProfileOwnership(
  userId: string,
  profileId: string,
): Promise<OwnershipResult<ProfileResult>> {
  const error = validateOwnershipInput(userId, profileId);
  if (error) return { valid: false, error };

  const profile = await prisma.profile.findFirst({
    where: {
      id: profileId,
      userId,
    },
  });

  if (!profile) {
    return {
      valid: false,
      error: NextResponse.json({ error: "Profile not found or access denied" }, { status: 404 }),
    };
  }

  return { valid: true, data: profile };
}

/**
 * Verify that the user owns an agent
 */
export async function verifyAgentOwnership(
  userId: string,
  agentId: string,
): Promise<OwnershipResult<AgentWithProfile>> {
  const error = validateOwnershipInput(userId, agentId);
  if (error) return { valid: false, error };

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { profile: true },
  });

  if (!agent || agent.profile.userId !== userId) {
    return {
      valid: false,
      error: NextResponse.json({ error: "Agent not found or access denied" }, { status: 404 }),
    };
  }

  return { valid: true, data: agent };
}

/**
 * Verify that the user owns a piece of content
 */
export async function verifyContentOwnership(
  userId: string,
  contentId: string,
): Promise<OwnershipResult<ContentWithProfile>> {
  const error = validateOwnershipInput(userId, contentId);
  if (error) return { valid: false, error };

  const content = await prisma.generatedContent.findUnique({
    where: { id: contentId },
    include: { profile: true },
  });

  if (!content || content.profile.userId !== userId) {
    return {
      valid: false,
      error: NextResponse.json({ error: "Content not found or access denied" }, { status: 404 }),
    };
  }

  return { valid: true, data: content };
}

/**
 * Verify that the user owns a connected account
 */
export async function verifyConnectedAccountOwnership(
  userId: string,
  accountId: string,
): Promise<OwnershipResult<AccountWithProfile>> {
  const error = validateOwnershipInput(userId, accountId);
  if (error) return { valid: false, error };

  const account = await prisma.connectedAccount.findUnique({
    where: { id: accountId },
    include: { profile: true },
  });

  if (!account || account.profile.userId !== userId) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Connected account not found or access denied" },
        { status: 404 },
      ),
    };
  }

  return { valid: true, data: account };
}

/**
 * Verify that the user owns a video asset
 */
export async function verifyVideoAssetOwnership(
  userId: string,
  videoAssetId: string,
): Promise<OwnershipResult<VideoAssetResult>> {
  const error = validateOwnershipInput(userId, videoAssetId);
  if (error) return { valid: false, error };

  const videoAsset = await prisma.videoAsset.findFirst({
    where: { id: videoAssetId, profile: { userId } },
  });

  if (!videoAsset) {
    return {
      valid: false,
      error: NextResponse.json({ error: "Video not found or access denied" }, { status: 404 }),
    };
  }

  return { valid: true, data: videoAsset };
}

/**
 * Verify that the user owns a media asset
 */
export async function verifyMediaAssetOwnership(
  userId: string,
  mediaAssetId: string,
): Promise<OwnershipResult<MediaAssetResult>> {
  const error = validateOwnershipInput(userId, mediaAssetId);
  if (error) return { valid: false, error };

  const mediaAsset = await prisma.mediaAsset.findFirst({
    where: {
      id: mediaAssetId,
      profile: { userId },
    },
  });

  if (!mediaAsset) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Media asset not found or access denied" },
        { status: 404 },
      ),
    };
  }

  return { valid: true, data: mediaAsset };
}

/**
 * Verify that the user owns an API key
 */
export async function verifyApiKeyOwnership(
  userId: string,
  apiKeyId: string,
): Promise<OwnershipResult<ApiKeyResult>> {
  const error = validateOwnershipInput(userId, apiKeyId);
  if (error) return { valid: false, error };

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId,
      revokedAt: null,
    },
  });

  if (!apiKey) {
    return {
      valid: false,
      error: NextResponse.json({ error: "API key not found or access denied" }, { status: 404 }),
    };
  }

  return { valid: true, data: apiKey };
}

/**
 * Verify that the user owns an agent run
 */
export async function verifyAgentRunOwnership(
  userId: string,
  runId: string,
): Promise<OwnershipResult<AgentRunWithAgentProfile>> {
  const error = validateOwnershipInput(userId, runId);
  if (error) return { valid: false, error };

  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    include: { agent: { include: { profile: true } } },
  });

  if (!run || run.agent.profile.userId !== userId) {
    return {
      valid: false,
      error: NextResponse.json({ error: "Agent run not found or access denied" }, { status: 404 }),
    };
  }

  return { valid: true, data: run };
}

// ---------------------------------------------------------------------------
// Team-aware access checks
// ---------------------------------------------------------------------------

/**
 * Verify that a user has access to a profile
 * Checks direct ownership FIRST, then team membership via profile.teamId
 */
export async function verifyProfileAccess(
  userId: string,
  profileId: string,
): Promise<OwnershipResult<ProfileResult>> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
  });

  if (!profile) {
    return { valid: false, error: notFound("Profile") };
  }

  // Direct ownership
  if (profile.userId === userId) {
    return { valid: true, data: profile };
  }

  // Team-based access
  if (profile.teamId) {
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId: profile.teamId,
        userId,
        role: { in: ["OWNER", "ADMIN", "EDITOR"] as TeamRole[] },
      },
    });

    if (membership) {
      return { valid: true, data: profile };
    }

    // Check if user is team owner
    const team = await prisma.team.findUnique({
      where: { id: profile.teamId },
      select: { ownerId: true },
    });

    if (team && team.ownerId === userId) {
      return { valid: true, data: profile };
    }

    return { valid: false, error: forbidden("You don't have access to this profile") };
  }

  return { valid: false, error: forbidden("You don't have access to this profile") };
}

/**
 * Verify that a user has access to a piece of content
 * Proxies through verifyProfileAccess
 */
export async function verifyContentAccess(
  userId: string,
  contentId: string,
): Promise<OwnershipResult<ContentWithProfile>> {
  const content = await prisma.generatedContent.findUnique({
    where: { id: contentId },
    include: { profile: true },
  });

  if (!content) {
    return { valid: false, error: notFound("Content") };
  }

  // Use profile access check
  const profileAccess = await verifyProfileAccess(userId, content.profileId);
  if (!profileAccess.valid) {
    return {
      valid: false,
      error: NextResponse.json({ error: "Content not found or access denied" }, { status: 404 }),
    };
  }

  return { valid: true, data: content };
}
