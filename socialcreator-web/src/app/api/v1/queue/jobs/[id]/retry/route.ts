/**
 * API v1 /queue/jobs/:id/retry route
 * POST — Retry a failed job, resetting it to queued status
 */

import { NextResponse } from "next/server";
import { addVersionHeaders } from "@/lib/api-version";
import { withApiMiddleware } from "@/lib/middleware/api-middleware";

export const POST = withApiMiddleware(async (_ctx, params) => {
  const { id } = params ?? {};

  if (!id) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }

  const { retryJob, getJob } = await import("@/lib/job-queue");
  const job = getJob(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status !== "failed") {
    return NextResponse.json({ error: "Only failed jobs can be retried" }, { status: 409 });
  }

  const success = retryJob(id);

  if (!success) {
    return NextResponse.json({ error: "Failed to retry job" }, { status: 500 });
  }

  const response = NextResponse.json({ success: true, id }, { status: 200 });
  addVersionHeaders(response, "v1");
  return response;
});
