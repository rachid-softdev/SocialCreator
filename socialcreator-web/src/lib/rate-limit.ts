/**
 * Rate Limiting utilities
 * 
 * Implémente du rate limiting simple basé sur les en-têtes HTTP
 * Pour une solution plus robuste en production, utiliser Upstash Redis
 * 
 * Stratégie: Token Bucket algorithm simplifié
 * Stockage: In-memory (se réinitialise au redémarrage du serveur)
 */

import { NextRequest, NextResponse } from "next/server";

// Configuration des limites
interface RateLimitConfig {
  limit: number      // Nombre max de requêtes
  window: number     // Fenêtre en secondes
}

// Limites par endpoint
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // API MCP - plus strict car exposé publiquement
  "/api/mcp": { limit: 60, window: 60 },         // 60 requêtes/min
  "/api/mcp/": { limit: 60, window: 60 },
  
  // Agents - création de runs
  "/api/agents/": { limit: 30, window: 60 },      // 30 runs/min
  "/api/agents/[id]/run": { limit: 10, window: 60 },
  
  // Content - création et publication
  "/api/content": { limit: 30, window: 60 },      // 30 contenus/min
  "/api/content/": { limit: 30, window: 60 },
  "/api/content/[id]/publish": { limit: 10, window: 60 },
  
  // Connected accounts - OAuth flows
  "/api/connected-accounts": { limit: 20, window: 60 },
  "/api/connected-accounts/": { limit: 20, window: 60 },
  
  // Profiles
  "/api/profiles": { limit: 20, window: 60 },
  "/api/profiles/": { limit: 20, window: 60 },
  
  // Video uploads
  "/api/video/upload": { limit: 10, window: 300 }, // 10 uploads/5min
  
  // Auth
  "/api/auth/register": { limit: 5, window: 300 },

  // Stripe
  "/api/stripe/checkout": { limit: 5, window: 60 },
  "/api/stripe/portal": { limit: 5, window: 60 },
  
  // Default pour les autres endpoints API
  "default": { limit: 100, window: 60 },
}

// In-memory store pour le rate limiting
// En production, remplacer par Redis (Upstash) pour persistance
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

/**
 * Nettoie le store des entrées expirées
 * À appeler périodiquement pour éviter les memory leaks
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}

// Nettoyer toutes les 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000)
}

/**
 * Extrait l'identifiant unique pour le rate limiting
 * Utilise l'IP du client ou l'ID utilisateur si connecté
 */
function getRateLimitKey(request: NextRequest, userId?: string): string {
  // Priorité: user ID si connecté, sinon IP
  if (userId) {
    return `user:${userId}`
  }
  
  // Extraire l'IP réel (support reverse proxy)
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim()
    return `ip:${ip}`
  }
  
  // Fallback sur l'IP directe
  const ip = request.headers.get("x-real-ip") || "unknown"
  return `ip:${ip}`
}

/**
 * Trouve la config de rate limit pour un chemin donnée
 */
function getRateLimitConfig(pathname: string): RateLimitConfig {
  // Vérification exacte
  if (RATE_LIMITS[pathname]) {
    return RATE_LIMITS[pathname]
  }
  
  // Vérification par préfixe
  for (const [key, config] of Object.entries(RATE_LIMITS)) {
    if (key.endsWith("/") && pathname.startsWith(key.replace(/\/$/, ""))) {
      return config
    }
    if (pathname.startsWith(key)) {
      return config
    }
  }
  
  // Si API, appliquer la limite par défaut
  if (pathname.startsWith("/api/")) {
    return RATE_LIMITS.default
  }
  
  // Pas de rate limiting pour les non-API
  return { limit: 1000, window: 60 }
}

/**
 * Vérifie si la requête respecte les limites de rate
 * Retourne null si OK, NextResponse avec 429 si bloqué
 */
export function checkRateLimit(
  request: NextRequest,
  userId?: string
): NextResponse | null {
  // Ignorer les requêtes non-API (pages, static)
  const pathname = request.nextUrl.pathname
  if (!pathname.startsWith("/api/")) {
    return null
  }
  
  // Ignorer certaines routes API (health checks, webhooks externes)
  const ignoredRoutes = ["/api/stripe/webhook", "/api/uploadthing"]
  if (ignoredRoutes.some(route => pathname.startsWith(route))) {
    return null
  }
  
  const config = getRateLimitConfig(pathname)
  const key = getRateLimitKey(request, userId)
  const now = Date.now()
  
  // Récupérer ou initialiser l'entrée
  let entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetTime < now) {
    // Nouvelle fenêtre
    entry = {
      count: 0,
      resetTime: now + (config.window * 1000),
    }
  }
  
  // Incrémenter et vérifier
  entry.count++
  
  if (entry.count > config.limit) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
    
    return NextResponse.json(
      {
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": config.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": entry.resetTime.toString(),
        },
      }
    )
  }
  
  // Mettre à jour le store
  rateLimitStore.set(key, entry)
  
  // Retourner les headers de rate limit pour la réponse
  return null
}

/**
 * Middleware function pour Next.js App Router
 * À utiliser dans les API routes
 */
export async function withRateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
  userId?: string
): Promise<NextResponse> {
  const rateLimitResponse = checkRateLimit(request, userId)
  
  if (rateLimitResponse) {
    return rateLimitResponse
  }
  
  const response = await handler()
  
  // Ajouter les headers de rate limit à la réponse
  const key = getRateLimitKey(request, userId)
  const entry = rateLimitStore.get(key)
  const config = getRateLimitConfig(request.nextUrl.pathname)
  
  if (entry) {
    response.headers.set("X-RateLimit-Limit", config.limit.toString())
    response.headers.set("X-RateLimit-Remaining", Math.max(0, config.limit - entry.count).toString())
    response.headers.set("X-RateLimit-Reset", entry.resetTime.toString())
  }
  
  return response
}

/**
 * Décorateur pour les handlers d'API routes Next.js
 * Usage:
 * 
 * export async function POST(request: NextRequest) {
 *   return withRateLimitDecorator(request, async () => {
 *     // votre logique ici
 *   })
 * }
 */
export function withRateLimitDecorator(
  userIdGetter?: (request: NextRequest) => string | undefined
) {
  return async function <T extends NextResponse>(
    request: NextRequest,
    handler: () => Promise<T>
  ): Promise<T> {
    const userId = userIdGetter ? userIdGetter(request) : undefined
    return withRateLimit(request, handler, userId) as Promise<T>
  }
}

// Fonction helper pour extraire l'user ID depuis le header Authorization
export function getUserIdFromAuth(request: NextRequest): string | undefined {
  const authHeader = request.headers.get("authorization")
  // À implémenter avec votre système d'auth actuel
  // Retourne l'user ID depuis le token JWT ou session
  return undefined // À implémenter selon votre auth
}