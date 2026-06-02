/**
 * Composable API middleware for routes
 * Applies: body-size-limit → rate-limiting → auth → request-id → error handling
 */

import { type NextRequest, NextResponse } from "next/server";
import { errorResponse, unauthorized } from "@/lib/api-errors";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit-redis";
import { getOrCreateRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";
import { httpRequestDuration, httpRequestTotal } from "@/lib/utils/metrics";

export interface ApiContext {
  userId: string;
  request: NextRequest;
}

export type ApiHandler = (
  ctx: ApiContext,
  params?: Record<string, string>,
) => Promise<NextResponse>;

/** Maximum request body size in bytes (100 KB) */
const MAX_BODY_SIZE = 100_000;

export function withApiMiddleware(handler: ApiHandler) {
  return async (
    request: NextRequest,
    { params }: { params?: Promise<Record<string, string>> } = {},
  ) => {
    const start = Date.now();
    const resolvedParams = params ? await params : {};

    // 0. Generate or propagate request ID for distributed tracing
    const requestId = getOrCreateRequestId(request);

    // 1. Enforce request body size limit
    if (request.body) {
      const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
      if (contentLength > MAX_BODY_SIZE) {
        return errorResponse(
          413,
          "LIMIT_REACHED",
          `Request body too large. Maximum is ${MAX_BODY_SIZE} bytes.`,
        );
      }
    }

    // 2. Rate limiting
    const rateLimitResult = await withRateLimit(request);
    if (rateLimitResult) return rateLimitResult;

    // 3. Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return unauthorized();
    }

    // 4. Execute handler
    try {
      const response = await handler({ userId: session.user.id, request }, resolvedParams);

      // 5. Add request ID to response headers
      const responseWithId = new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
      responseWithId.headers.set(REQUEST_ID_HEADER, requestId);

      // 6. Record HTTP metrics
      const route = request.nextUrl.pathname;
      const method = request.method;
      const dur = (Date.now() - start) / 1000;
      httpRequestDuration.observe({ method, route, status: response.status }, dur);
      httpRequestTotal.inc({ method, route, status: response.status });

      // 7. Logging (no PII) with request ID
      logger.info(
        {
          requestId,
          method,
          path: route,
          duration: Date.now() - start,
          status: response.status,
        },
        "API request completed",
      );

      return responseWithId;
    } catch (error) {
      const route = request.nextUrl.pathname;
      const method = request.method;

      // Record HTTP metrics for errors too
      httpRequestDuration.observe({ method, route, status: 500 }, (Date.now() - start) / 1000);
      httpRequestTotal.inc({ method, route, status: 500 });

      logger.error(
        {
          requestId,
          err: error,
          method,
          path: route,
          duration: Date.now() - start,
        },
        "API request failed",
      );
      return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
    }
  };
}
