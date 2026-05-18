/**
 * Ownership validation utilities
 * 
 * Fonctions pour vérifier qu'un utilisateur a bien ownership
 * sur les ressources auxquelles il essaie d'accéder
 */

import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/**
 * Vérifie que l'utilisateur est propriétaire d'un profile
 */
export async function verifyProfileOwnership(
  userId: string,
  profileId: string
): Promise<{ valid: boolean; profile?: any; error?: NextResponse }> {
  const profile = await prisma.profile.findFirst({
    where: {
      id: profileId,
      userId,
    },
  })

  if (!profile) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Profile not found or access denied" },
        { status: 404 }
      ),
    }
  }

  return { valid: true, profile }
}

/**
 * Vérifie que l'utilisateur est propriétaire d'un agent
 */
export async function verifyAgentOwnership(
  userId: string,
  agentId: string
): Promise<{ valid: boolean; agent?: any; error?: NextResponse }> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { profile: true },
  }) as any

  if (!agent || agent.profile.userId !== userId) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Agent not found or access denied" },
        { status: 404 }
      ),
    }
  }

  return { valid: true, agent }
}

/**
 * Vérifie que l'utilisateur est propriétaire d'un contenu
 */
export async function verifyContentOwnership(
  userId: string,
  contentId: string
): Promise<{ valid: boolean; content?: any; error?: NextResponse }> {
  const content = await prisma.generatedContent.findUnique({
    where: { id: contentId },
    include: { profile: true },
  }) as any

  if (!content || content.profile.userId !== userId) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Content not found or access denied" },
        { status: 404 }
      ),
    }
  }

  return { valid: true, content }
}

/**
 * Vérifie que l'utilisateur est propriétaire d'un connected account
 */
export async function verifyConnectedAccountOwnership(
  userId: string,
  accountId: string
): Promise<{ valid: boolean; account?: any; error?: NextResponse }> {
  const account = await prisma.connectedAccount.findUnique({
    where: { id: accountId },
    include: { profile: true },
  }) as any

  if (!account || account.profile.userId !== userId) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Connected account not found or access denied" },
        { status: 404 }
      ),
    }
  }

  return { valid: true, account }
}

/**
 * Vérifie que l'utilisateur est propriétaire d'un video asset
 */
export async function verifyVideoAssetOwnership(
  userId: string,
  videoAssetId: string
): Promise<{ valid: boolean; videoAsset?: any; error?: NextResponse }> {
  const videoAsset = await prisma.videoAsset.findUnique({
    where: { id: videoAssetId },
  }) as any

  if (!videoAsset) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Video asset not found" },
        { status: 404 }
      ),
    }
  }

  const profile = await prisma.profile.findUnique({
    where: { id: videoAsset.profileId },
  }) as any

  if (!profile || profile.userId !== userId) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      ),
    }
  }

  return { valid: true, videoAsset }
}

/**
 * Vérifie que l'utilisateur est propriétaire d'un agent run
 */
export async function verifyAgentRunOwnership(
  userId: string,
  runId: string
): Promise<{ valid: boolean; run?: any; error?: NextResponse }> {
  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    include: { agent: { include: { profile: true } } },
  }) as any

  if (!run || run.agent.profile.userId !== userId) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Agent run not found or access denied" },
        { status: 404 }
      ),
    }
  }

  return { valid: true, run }
}