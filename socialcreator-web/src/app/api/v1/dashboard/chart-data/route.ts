import { NextResponse } from "next/server";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

export const GET = withApiMiddleware(async ({ userId, request }) => {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7");

  const { publishLog: publishLogRepo } = getRepositories();
  const data = await publishLogRepo.getDailyStats(userId, days);

  return NextResponse.json({ data, days });
});
