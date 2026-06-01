/**
 * CGU Guard - Terms of Service acceptance verification
 *
 * Used to ensure the user has accepted the Terms of Service
 * before accessing publishing features
 *
 * Usage in API routes:
 *
 * export async function POST(request: NextRequest) {
 *   await requireCguAccepted(request) // Throws an error if CGU not accepted
 *   // ... logic
 * }
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface CguCheckOptions {
  requireCguForPublishing?: boolean; // For publishing routes
  requireCguForAgents?: boolean; // For agent routes
  requireCguForAccounts?: boolean; // For connected account routes
}

const DEFAULT_OPTIONS: CguCheckOptions = {
  requireCguForPublishing: true,
  requireCguForAgents: false,
  requireCguForAccounts: false,
};

/**
 * Check if the user has accepted the Terms of Service
 * Uses the session token for a quick check
 * and makes a DB query for confirmation
 */
export async function requireCguAccepted(
  request: Request,
  _options: CguCheckOptions = DEFAULT_OPTIONS,
): Promise<{ userId: string; cguAccepted: boolean }> {
  const session = await auth();

  if (!session?.user?.id) {
    throw {
      status: 401,
      message: "Authentication required",
    };
  }

  // Quick check via session token
  // Note: In NextAuth v5, the token contains additional info
  const _cguAccepted = (session as any).user?.cguAccepted || false;

  // For certain actions, require that the user has really accepted the CGU
  // Perform a DB check to confirm
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { cguAccepted: true, cguAcceptedAt: true },
  });

  const dbCguAccepted = user?.cguAccepted || false;

  // If not accepted in DB, block access to sensitive features
  if (!dbCguAccepted) {
    const url = new URL(request.url);

    // Audit log
    console.warn("CGU not accepted", {
      userId: session.user.id,
      pathname: url.pathname,
      timestamp: new Date().toISOString(),
    });

    throw {
      status: 403,
      message: "CGU acceptance required",
      redirectUrl: "/onboarding/cgu",
    };
  }

  return {
    userId: session.user.id,
    cguAccepted: dbCguAccepted,
  };
}

/**
 * Wrapper for API route handlers
 * Usage:
 *
 * export async function POST(request: NextRequest) {
 *   return withCguGuard(request, async (userId) => {
 *     // your logic here with userId
 *   })
 * }
 */
export async function withCguGuard<T>(
  request: Request,
  handler: (userId: string) => Promise<T>,
  options?: CguCheckOptions,
): Promise<T> {
  const { userId } = await requireCguAccepted(request, options);
  return handler(userId);
}

/**
 * Middleware function to check CGU on pages
 * To be used in server-side page layouts
 */
export async function checkCguForPage(): Promise<{
  redirect?: string;
  userId?: string;
}> {
  const session = await auth();

  if (!session?.user?.id) {
    return { redirect: "/login" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { cguAccepted: true },
  });

  if (!user?.cguAccepted) {
    return { redirect: "/onboarding/cgu" };
  }

  return { userId: session.user.id };
}

/**
 * List of routes that require CGU acceptance
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
];

/**
 * Check if a route requires CGU acceptance
 */
export function requiresCgu(pathname: string): boolean {
  return CGU_REQUIRED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
