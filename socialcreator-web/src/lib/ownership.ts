/**
 * Ownership validation utilities
 *
 * Functions to verify that a user has ownership of the resources they are
 * trying to access.
 */

import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Ownership result types
// ---------------------------------------------------------------------------

type OwnershipResultSuccess<T> = { valid: true; data: T };
type OwnershipResultError = { valid: false; error: NextResponse };
type OwnershipResult<T> = OwnershipResultSuccess<T> | OwnershipResultError;

// Prisma GetPayload helpers
type ProfileResult = Prisma.ProfileGetPayload<{}>;
type AgentWithProfile = Prisma.AgentGetPayload<{ include: { profile: true } }>;
type ContentWithProfile = Prisma.GeneratedContentGetPayload<{
  include: { profile: true };
}>;
type AccountWithProfile = Prisma.ConnectedAccountGetPayload<{
  include: { profile: true };
}>;
type VideoAssetResult = Prisma.VideoAssetGetPayload<{}>;
type AgentRunWithAgentProfile = Prisma.AgentRunGetPayload<{
  include: { agent: { include: { profile: true } } };
}>;

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
  const videoAsset = await prisma.videoAsset.findUnique({
    where: { id: videoAssetId },
  });

  if (!videoAsset) {
    return {
      valid: false,
      error: NextResponse.json({ error: "Video asset not found" }, { status: 404 }),
    };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: videoAsset.profileId },
  });

  if (!profile || profile.userId !== userId) {
    return {
      valid: false,
      error: NextResponse.json({ error: "Access denied" }, { status: 403 }),
    };
  }

  return { valid: true, data: videoAsset };
}

/**
 * Verify that the user owns an agent run
 */
export async function verifyAgentRunOwnership(
  userId: string,
  runId: string,
): Promise<OwnershipResult<AgentRunWithAgentProfile>> {
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
