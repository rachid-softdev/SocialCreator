/**
 * Composable API middleware for routes
 * Applies: rate-limiting → auth → error handling
 */

import type { NextRequest, NextResponse } from "next/server";
import { errorResponse, unauthorized } from "@/lib/api-errors";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit-redis";

export interface ApiContext {
  userId: string;
  request: NextRequest;
}

export type ApiHandler = (
  ctx: ApiContext,
  params?: Record<string, string>,
) => Promise<NextResponse>;

export function withApiMiddleware(handler: ApiHandler) {
  return async (
    request: NextRequest,
    { params }: { params?: Promise<Record<string, string>> } = {},
  ) => {
    const start = Date.now();
    const resolvedParams = params ? await params : {};

    // 1. Rate limiting
    const rateLimitResult = await withRateLimit(request);
    if (rateLimitResult) return rateLimitResult;

    // 2. Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return unauthorized();
    }

    // 3. Execute handler
    try {
      const response = await handler({ userId: session.user.id, request }, resolvedParams);

      // 4. Logging (no PII)
      logger.info(
        {
          method: request.method,
          path: request.nextUrl.pathname,
          duration: Date.now() - start,
          status: response.status,
        },
        "API request completed",
      );

      return response;
    } catch (error) {
      logger.error(
        {
          err: error,
          method: request.method,
          path: request.nextUrl.pathname,
          duration: Date.now() - start,
        },
        "API request failed",
      );
      return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
    }
  };
}
