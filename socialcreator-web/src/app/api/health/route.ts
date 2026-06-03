import { NextResponse } from "next/server";
import { getHealth } from "@/lib/observability/health";
import { runWithContext } from "@/lib/observability/request-context";
import { generateRequestId } from "@/lib/observability/request-id";

export async function GET() {
  const requestId = generateRequestId();

  return runWithContext({ requestId, method: "GET", path: "/api/health" }, async () => {
    const result = await getHealth();
    const httpStatus = result.status === "healthy" ? 200 : 503;

    return NextResponse.json(result, { status: httpStatus });
  });
}
