/**
 * API v1 /queue/status route
 * Returns current job queue status counters
 */

import { NextResponse } from "next/server";
import { addVersionHeaders } from "@/lib/api-version";
import { withApiMiddleware } from "@/lib/middleware/api-middleware";

export const GET = withApiMiddleware(async () => {
  const { getQueueStatus } = await import("@/lib/job-queue");
  const status = getQueueStatus();

  const response = NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
  addVersionHeaders(response, "v1");
  return response;
});
