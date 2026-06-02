/**
 * API v1 /health route
 * Lightweight health check endpoint
 */

import { NextResponse } from "next/server";
import { addVersionHeaders } from "@/lib/api-version";

// GET /api/v1/health
export async function GET() {
  const response = NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "v1",
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60",
      },
    },
  );
  addVersionHeaders(response, "v1");
  return response;
}
