/**
 * SSE (Server-Sent Events) endpoint for real-time notifications
 *
 * Sends keepalive every 30s to maintain connection.
 * Real-time Redis pub/sub delivery requires a compatible Redis client
 * (e.g., ioredis) — for now, the client-side hook uses polling as fallback.
 *
 * NOTE: SSE may not work on serverless platforms — use polling fallback in the hook.
 *
 * SECURITY: Rate-limited to MAX_CONNECTIONS per user to prevent DoS.
 */

import { auth } from "@/lib/auth";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Per-user SSE connection tracking for DoS prevention
const userConnections = new Map<string, Set<WritableStreamDefaultWriter>>();
const MAX_CONNECTIONS_PER_USER = 5;

function trackConnection(userId: string, writer: WritableStreamDefaultWriter): boolean {
  let connections = userConnections.get(userId);
  if (!connections) {
    connections = new Set();
    userConnections.set(userId, connections);
  }
  if (connections.size >= MAX_CONNECTIONS_PER_USER) {
    return false;
  }
  connections.add(writer);
  return true;
}

function untrackConnection(userId: string, writer: WritableStreamDefaultWriter): void {
  const connections = userConnections.get(userId);
  if (!connections) return;
  connections.delete(writer);
  if (connections.size === 0) {
    userConnections.delete(userId);
  }
}

// GET /api/v1/notifications/stream
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  // Create a TransformStream for SSE
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Enforce per-user connection limit
  if (!trackConnection(userId, writer)) {
    writer.close().catch(() => {});
    return new Response("Too many connections. Close existing streams first.", { status: 429 });
  }

  // Helper to send SSE events
  const sendEvent = (event: string, data: unknown) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    return writer.write(encoder.encode(message));
  };

  // Send initial connected event
  sendEvent("connected", { userId }).catch(() => {});

  // Send keepalive every 30 seconds to prevent connection timeout
  const keepaliveInterval = setInterval(() => {
    sendEvent("keepalive", { timestamp: new Date().toISOString() }).catch(() => {
      // Connection likely closed, clear interval
      clearInterval(keepaliveInterval);
    });
  }, 30_000);

  // Handle client disconnect
  request.signal.addEventListener("abort", () => {
    clearInterval(keepaliveInterval);
    untrackConnection(userId, writer);
    writer.close().catch(() => {});
    logger.debug({ userId }, "SSE client disconnected");
  });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
