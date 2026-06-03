import pino, { type Logger } from "pino";
import { getRequestId } from "./request-context";

const rootLogger: Logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "userId",
      "*.userId",
      "accessToken",
      "*.accessToken",
      "refreshToken",
      "*.refreshToken",
      "sessionToken",
      "*.sessionToken",
      "csrfToken",
      "*.csrfToken",
      "clientSecret",
      "*.clientSecret",
      "privateKey",
      "*.privateKey",
      "webhookSecret",
      "*.webhookSecret",
      "token",
      "*.token",
      "secret",
      "*.secret",
      "password",
      "*.password",
      "email",
      "*.email",
      "authorization",
      "*.authorization",
      "bearer",
      "*.bearer",
      "cookie",
      "*.cookie",
      "apiKey",
      "*.apiKey",
      "idempotencyKey",
      "*.idempotencyKey",
      "ip",
      "*.ip",
    ],
    censor: "[REDACTED]",
  },
});

export default rootLogger;

/**
 * Create a child logger scoped to a specific component.
 */
export function createLogger(component: string): Logger {
  return rootLogger.child({ component });
}

/**
 * Create a request-scoped child logger with request context fields.
 */
export function createRequestLogger(ctx: {
  requestId: string;
  method?: string;
  path?: string;
  userId?: string;
}): Logger {
  return rootLogger.child({
    requestId: ctx.requestId,
    method: ctx.method,
    path: ctx.path,
    userId: ctx.userId,
  });
}

/**
 * Get a logger for the current context.
 *
 * Returns a child logger scoped to the optional component.
 * If a request context is active via AsyncLocalStorage, the
 * returned logger automatically includes the requestId.
 *
 * Use this for logging anywhere outside a request scope
 * to still pick up request context when available.
 */
export function getLogger(component?: string): Logger {
  const requestId = getRequestId();
  const hasRequestId = requestId !== "no-request-id";

  if (component && hasRequestId) {
    return rootLogger.child({ component, requestId });
  }
  if (component) {
    return rootLogger.child({ component });
  }
  if (hasRequestId) {
    return rootLogger.child({ requestId });
  }
  return rootLogger;
}
