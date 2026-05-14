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
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      profile: { userId },
    },
    include: { profile: true },
  })

  if (!agent) {
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
  const content = await prisma.generatedContent.findFirst({
    where: {
      id: contentId,
      profile: { userId },
    },
    include: { profile: true },
  })

  if (!content) {
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
  const account = await prisma.connectedAccount.findFirst({
    where: {
      id: accountId,
      profile: { userId },
    },
    include: { profile: true },
  })

  if (!account) {
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
 * Vérifie que l'utilisateur est propriétaire d'un API key
 */
export async function verifyApiKeyOwnership(
  userId: string,
  apiKeyId: string
): Promise<{ valid: boolean; apiKey?: any; error?: NextResponse }> {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId,
    },
  })

  if (!apiKey) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "API key not found or access denied" },
        { status: 404 }
      ),
    }
  }

  return { valid: true, apiKey }
}

/**
 * Vérifie que l'utilisateur est propriétaire d'un run d'agent
 */
export async function verifyAgentRunOwnership(
  userId: string,
  runId: string
): Promise<{ valid: boolean; run?: any; error?: NextResponse }> {
  const run = await prisma.agentRun.findFirst({
    where: {
      id: runId,
      agent: { profile: { userId } },
    },
    include: { agent: true },
  })

  if (!run) {
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

/**
 * Vérifie que l'utilisateur est propriétaire d'une vidéo
 */
export async function verifyVideoAssetOwnership(
  userId: string,
  videoAssetId: string
): Promise<{ valid: boolean; videoAsset?: any; error?: NextResponse }> {
  const videoAsset = await prisma.videoAsset.findFirst({
    where: {
      id: videoAssetId,
      profile: { userId },
    },
    include: { profile: true },
  })

  if (!videoAsset) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Video asset not found or access denied" },
        { status: 404 }
      ),
    }
  }

  return { valid: true, videoAsset }
}

/**
 * Type guard pour les erreurs NextResponse
 */
function isNextResponse(obj: any): obj is NextResponse {
  return obj && typeof obj.status === "number"
}

/**
 * Wrapper pour ajouter automatiquement le ownership check à une route
 * Usage:
 * 
 * export async function GET(
 *   request: NextRequest,
 *   { params }: { params: { id: string } }
 * ) {
 *   return withOwnership(request, async (userId) => {
 *     const { profile, error } = await verifyProfileOwnership(userId, params.id)
 *     if (error) return error
 *     // ... logique
 *   })
 * }
 */
export async function withOwnership(
  request: Request,
  handler: (userId: string) => Promise<any>
): Promise<any> {
  const session = await (await import("@/lib/auth")).auth()
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    )
  }

  return handler(session.user.id)
}

/**
 * Middleware pour vérifier le ownership sur les routes agent
 * Usage dans /api/agents/[id]/run/route.ts
 */
export async function withAgentOwnership(
  agentId: string,
  userId: string
): Promise<{ agent: any; error?: NextResponse }> {
  const result = await verifyAgentOwnership(userId, agentId)
  if (!result.valid) {
    return { agent: null, error: result.error || undefined }
  }
  return { agent: result.agent }
}

/**
 * Middleware pour vérifier le ownership sur les routes content
 */
export async function withContentOwnership(
  contentId: string,
  userId: string
): Promise<{ content: any; error?: NextResponse }> {
  const result = await verifyContentOwnership(userId, contentId)
  if (!result.valid) {
    return { content: null, error: result.error || undefined }
  }
  return { content: result.content }
}