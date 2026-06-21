import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeSubscriptionId: true, stripeCustomerId: true },
  });

  if (!user?.stripeSubscriptionId) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 400 });
  }

  try {
    const stripe = getStripe();

    // Cancel at period end — subscription remains active until period end
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update local DB record
    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeSubscriptionStatus: "canceled" },
    });

    logger.info(
      { userId: session.user.id, subscriptionId: user.stripeSubscriptionId },
      "Subscription cancelled at period end",
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to cancel subscription");
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}
