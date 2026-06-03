import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { register } from "@/lib/utils/metrics";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const metrics = await register.metrics();
  return new NextResponse(metrics, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
