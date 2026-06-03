/**
 * API v1 /queue/jobs route
 * GET — Returns list of jobs from the in-memory queue
 * Supports optional type and status query filters
 */

import { NextResponse } from "next/server";
import { addVersionHeaders } from "@/lib/api-version";
import { withApiMiddleware } from "@/lib/middleware/api-middleware";

export const GET = withApiMiddleware(async ({ request }) => {
  const { searchParams } = new URL(request.url);
  const filterType = searchParams.get("type");
  const filterStatus = searchParams.get("status");

  const { getJobs } = await import("@/lib/job-queue");
  let jobs = getJobs();

  if (filterType) {
    jobs = jobs.filter((j) => j.type === filterType);
  }

  if (filterStatus) {
    jobs = jobs.filter((j) => j.status === filterStatus);
  }

  const mapped = jobs.map((j) => ({
    id: j.id,
    type: j.type,
    status: j.status,
    priority: j.priority,
    attempts: j.attempts,
    maxAttempts: j.maxAttempts,
    createdAt: j.createdAt,
    completedAt: j.completedAt,
    error: j.error,
  }));

  const response = NextResponse.json(mapped, {
    headers: { "Cache-Control": "no-store" },
  });
  addVersionHeaders(response, "v1");
  return response;
});
