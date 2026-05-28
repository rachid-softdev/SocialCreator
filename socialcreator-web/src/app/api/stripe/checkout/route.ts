import { NextResponse } from "next/server";
import { withApiMiddleware } from "@/lib/api-middleware";
import { createCheckoutSession, type PlanKey } from "@/lib/stripe";

export const POST = withApiMiddleware(async ({ userId, request }) => {
  const body = await request.json();
  const { plan, additionalProfiles = 0 } = body as {
    plan: PlanKey;
    additionalProfiles?: number;
  };

  if (!plan || !["starter", "pro", "team"].includes(plan)) {
    return NextResponse.json(
      { error: "Invalid plan. Must be: starter, pro, or team" },
      { status: 400 },
    );
  }

  // Get the user email from session (stored in auth)
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "User email not found" }, { status: 400 });
  }

  const { url } = await createCheckoutSession(userId, session.user.email, plan, additionalProfiles);

  return NextResponse.json({ url });
});
