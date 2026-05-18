/**
 * CGU Guard - Vérification des Conditions Générales d'Utilisation
 * 
 * Utilisé pour s'assurer que l'utilisateur a accepté les CGU
 * avant d'accéder aux fonctionnalités de publication
 * 
 * Usage dans les API routes:
 * 
 * export async function POST(request: NextRequest) {
 *   await requireCguAccepted(request) // Lance une erreur si CGU pas acceptée
 *   // ... logique
 * }
 */

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export interface CguCheckOptions {
  requireCguForPublishing?: boolean  // Pour les routes de publication
  requireCguForAgents?: boolean     // Pour les routes d'agents
  requireCguForAccounts?: boolean   // Pour les routes de comptes connectés
}

const DEFAULT_OPTIONS: CguCheckOptions = {
  requireCguForPublishing: true,
  requireCguForAgents: false,
  requireCguForAccounts: false,
}

/**
 * Vérifie si l'utilisateur a accepté les CGU
 * Utilise le token de session pour une vérification rapide
 * et fait une requête DB pour confirmation
 */
export async function requireCguAccepted(
  request: Request,
  options: CguCheckOptions = DEFAULT_OPTIONS
): Promise<{ userId: string; cguAccepted: boolean }> {
  const session = await auth()
  
  if (!session?.user?.id) {
    throw {
      status: 401,
      message: "Authentication required",
    }
  }
  
  // Vérification rapide via le token de session
  // Note: Dans NextAuth v5, le token contient les infos supplémentaires
  const cguAccepted = (session as any).user?.cguAccepted || false
  
  // Pour certaines actions, on nécessite que l'utilisateur ait vraiment accepté les CGU
  // делаем une vérification DB pour confirmer
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { cguAccepted: true, cguAcceptedAt: true },
  })
  
  const dbCguAccepted = user?.cguAccepted || false
  
  // Si pas acceptée en DB, bloquer l'accès aux fonctionnalités sensibles
  if (!dbCguAccepted) {
    const url = new URL(request.url)
    
    // Log pour audit
    console.warn("CGU not accepted", {
      userId: session.user.id,
      pathname: url.pathname,
      timestamp: new Date().toISOString(),
    })
    
    throw {
      status: 403,
      message: "CGU acceptance required",
      redirectUrl: "/onboarding/cgu",
    }
  }
  
  return {
    userId: session.user.id,
    cguAccepted: dbCguAccepted,
  }
}

/**
 * Wrapper pour les handlers d'API routes
 * Usage:
 * 
 * export async function POST(request: NextRequest) {
 *   return withCguGuard(request, async (userId) => {
 *     // votre logique ici avec userId
 *   })
 * }
 */
export async function withCguGuard<T>(
  request: Request,
  handler: (userId: string) => Promise<T>,
  options?: CguCheckOptions
): Promise<T> {
  const { userId } = await requireCguAccepted(request, options)
  return handler(userId)
}

/**
 * Middleware function pour vérifier CGU sur les pages
 * À utiliser dans les page layouts server-side
 */
export async function checkCguForPage(): Promise<{
  redirect?: string
  userId?: string
}> {
  const session = await auth()
  
  if (!session?.user?.id) {
    return { redirect: "/login" }
  }
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { cguAccepted: true },
  })
  
  if (!user?.cguAccepted) {
    return { redirect: "/onboarding/cgu" }
  }
  
  return { userId: session.user.id }
}

/**
 * Liste des routes qui nécessitent l'acceptation des CGU
 */
export const CGU_REQUIRED_ROUTES = [
  // Pages
  "/dashboard",
  "/profiles",
  "/agents",
  "/content",
  "/video",
  "/analytics",
  "/settings/billing",
  "/settings/api-keys",
  
  // API endpoints
  "/api/agents",
  "/api/content",
  "/api/connected-accounts",
  "/api/profiles",
  "/api/stripe/checkout",
  "/api/stripe/portal",
  "/api/mcp",
]

/**
 * Vérifie si une route nécessite CGU
 */
export function requiresCgu(pathname: string): boolean {
  return CGU_REQUIRED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + "/")
  )
}