/**
 * API v1 /queue/status route
 * Returns current job queue status counters
 */

import { NextResponse } from "next/server";
import { addVersionHeaders } from "@/lib/api-version";
import { getQueueStatus } from "@/lib/job-queue";

// GET /api/v1/queue/status
export async function GET() {
  const status = getQueueStatus();

  const response = NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
  addVersionHeaders(response, "v1");
  return response;
}
