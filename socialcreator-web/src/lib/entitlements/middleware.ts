/**
 * Feature Flags & Entitlements - Middleware Factory
 * Framework-agnostic factory functions
 * No if(plan === "PRO") in endpoints - use these instead
 */

import logger from "@/lib/logger";
import {
  createFeatureNotAvailableError,
  createLimitReachedError,
  getFeatureGateService,
} from "./service";

export interface MiddlewareContext {
  orgId: string;
  userId?: string;
}

export type MiddlewareHandler = (
  context: MiddlewareContext,
  handler: () => Promise<Response>,
) => Promise<Response>;

/**
 * Factory: requireFeature
 * Returns 403 if feature is not available
 * Does NOT consume any quota
 */
export function requireFeature(featureKey: string): MiddlewareHandler {
  return async (context, handler) => {
    const service = getFeatureGateService();
    const hasFeature = await service.hasFeature(context.orgId, featureKey);

    if (!hasFeature) {
      const trace = await service.getDebugTrace(context.orgId, featureKey);
      const error = createFeatureNotAvailableError(featureKey, trace.planKey || "free");

      return new Response(JSON.stringify(error), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    return handler();
  };
}

/**
 * Factory: requireLimit
 * Check if feature limit is available WITHOUT consuming
 * Returns current usage info in headers
 */
export function requireLimit(limitKey: string): MiddlewareHandler {
  return async (context, handler) => {
    const service = getFeatureGateService();
    const limit = await service.getLimit(context.orgId, limitKey);

    if (limit === null) {
      // Unlimited - continue
      return handler();
    }

    // Check current usage
    const canConsume = await service.canConsume(context.orgId, limitKey, 1);

    if (!canConsume) {
      const entitlements = await service.getAllEntitlements(context.orgId);
      const used = entitlements.usage[limitKey] || 0;
      const resetAt = entitlements.resetAt[limitKey];

      const error = createLimitReachedError(limitKey, limit, used, resetAt ?? new Date());

      return new Response(JSON.stringify(error), {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": Math.max(0, limit - used).toString(),
        },
      });
    }

    // Add remaining info to headers for client
    const response = await handler();

    if (response.headers) {
      const entitlements = await service.getAllEntitlements(context.orgId);
      response.headers.set("X-RateLimit-Limit", (limit || 0).toString());
      response.headers.set(
        "X-RateLimit-Remaining",
        Math.max(0, (limit || 0) - (entitlements.usage[limitKey] || 0)).toString(),
      );
    }

    return response;
  };
}

/**
 * Factory: consumeFeature
 * Check AND consume quota atomically
 * Returns 402 if limit reached
 */
export function consumeFeature(featureKey: string, amount: number = 1): MiddlewareHandler {
  return async (context, handler) => {
    const service = getFeatureGateService();

    // First check if feature is available
    const hasFeature = await service.hasFeature(context.orgId, featureKey);
    if (!hasFeature) {
      const trace = await service.getDebugTrace(context.orgId, featureKey);
      const error = createFeatureNotAvailableError(featureKey, trace.planKey || "free");

      return new Response(JSON.stringify(error), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Consume the quota
    const result = await service.consume(context.orgId, featureKey, amount);

    if (!result.success) {
      const error = createLimitReachedError(
        featureKey,
        result.limit || 0,
        result.used,
        result.resetAt,
      );

      return new Response(JSON.stringify(error), {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": (result.limit || 0).toString(),
          "X-RateLimit-Remaining": "0",
        },
      });
    }

    // Add usage info to response headers
    const response = await handler();

    if (response.headers) {
      response.headers.set("X-RateLimit-Limit", (result.limit || 0).toString());
      response.headers.set(
        "X-RateLimit-Remaining",
        Math.max(0, (result.limit || 0) - result.used).toString(),
      );
    }

    return response;
  };
}

/**
 * Combine multiple middleware in sequence
 */
export function withEntitlements(...middlewares: MiddlewareHandler[]): MiddlewareHandler {
  return async (context, handler) => {
    let currentHandler = handler;

    // Build middleware chain in reverse
    for (let i = middlewares.length - 1; i >= 0; i--) {
      const middleware = middlewares[i]!;
      const nextHandler = currentHandler;
      currentHandler = () => middleware(context, nextHandler);
    }

    return currentHandler();
  };
}

/**
 * Helper to extract orgId from request
 * In production, this would come from session/auth
 */
export function getOrgIdFromRequest(request: Request): string | null {
  // Check header first (for API keys, etc)
  const orgIdHeader = request.headers.get("x-org-id");
  if (orgIdHeader) return orgIdHeader;

  // Check query param
  const url = new URL(request.url);
  const orgIdQuery = url.searchParams.get("orgId");
  if (orgIdQuery) return orgIdQuery;

  return null;
}

/**
 * Wrapper for Next.js App Router handlers
 * Usage:
 *   export const POST = withFeature("EXPORT_PDF", async (req) => { ... })
 */
export function withFeature(featureKey: string, handler: (req: Request) => Promise<Response>) {
  return async (request: Request) => {
    const orgId = getOrgIdFromRequest(request);
    if (!orgId) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const middleware = requireFeature(featureKey);
    return middleware({ orgId }, () => handler(request));
  };
}

/**
 * Wrapper with limit check
 */
export function withLimit(limitKey: string, handler: (req: Request) => Promise<Response>) {
  return async (request: Request) => {
    const orgId = getOrgIdFromRequest(request);
    if (!orgId) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const middleware = requireLimit(limitKey);
    return middleware({ orgId }, () => handler(request));
  };
}

/**
 * Wrapper with consumption
 */
export function withConsume(
  featureKey: string,
  amount: number = 1,
  handler: (req: Request) => Promise<Response>,
) {
  return async (request: Request) => {
    const orgId = getOrgIdFromRequest(request);
    if (!orgId) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const middleware = consumeFeature(featureKey, amount);
    return middleware({ orgId }, () => handler(request));
  };
}

// ============================================
// Express-style middleware (for reference)
// ============================================

/**
 * Express middleware version
 * Usage:
 *   router.post("/export", requireFeature("EXPORT_PDF"), exportHandler)
 */
export function expressRequireFeature(featureKey: string) {
  return (req: any, res: any, next: any) => {
    const orgId = req.headers["x-org-id"] || req.query.orgId;
    if (!orgId) {
      return res.status(401).json({ error: "Organization not found" });
    }

    return getFeatureGateService()
      .hasFeature(orgId, featureKey)
      .then((hasFeature) => {
        if (!hasFeature) {
          return res.status(403).json({
            error: "FEATURE_NOT_AVAILABLE",
            feature: featureKey,
          });
        }
        next();
      })
      .catch((err) => {
        logger.error({ err }, "[Entitlements] Middleware error");
        res.status(500).json({ error: "Internal server error" });
      });
  };
}

export function expressConsumeFeature(featureKey: string, amount: number = 1) {
  return (req: any, res: any, next: any) => {
    const orgId = req.headers["x-org-id"] || req.query.orgId;
    if (!orgId) {
      return res.status(401).json({ error: "Organization not found" });
    }

    return getFeatureGateService()
      .consume(orgId, featureKey, amount)
      .then((result) => {
        if (!result.success) {
          return res.status(402).json({
            error: "LIMIT_REACHED",
            feature: featureKey,
            limit: result.limit,
            used: result.used,
            resetAt: result.resetAt.toISOString(),
          });
        }

        // Add headers
        res.setHeader("X-RateLimit-Limit", result.limit || 0);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, (result.limit || 0) - result.used));
        next();
      })
      .catch((err) => {
        logger.error({ err }, "[Entitlements] Middleware error");
        res.status(500).json({ error: "Internal server error" });
      });
  };
}

const entitlementsMiddleware = {
  requireFeature,
  requireLimit,
  consumeFeature,
  withEntitlements,
  withFeature,
  withLimit,
  withConsume,
  expressRequireFeature,
  expressConsumeFeature,
};

export default entitlementsMiddleware;
