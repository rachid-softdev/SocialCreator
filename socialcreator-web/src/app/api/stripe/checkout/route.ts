import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createCheckoutSession, type PlanKey } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session?.user?.email) {
    return NextResponse.json({ error: "User email not found" }, { status: 400 });
  }

  try {
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

    const { url } = await createCheckoutSession(
      session.user.id,
      session.user.email,
      plan,
      additionalProfiles,
    );

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
