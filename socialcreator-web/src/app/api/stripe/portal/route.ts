import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { createBillingPortal } from "@/lib/stripe";

export async function POST(_request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: "No subscription found" }, { status: 400 });
  }

  try {
    const url = await createBillingPortal(user.stripeCustomerId);
    return NextResponse.json({ url });
  } catch (error) {
    logger.error({ err: error }, "Stripe portal error");
    return NextResponse.json({ error: "Failed to create billing portal session" }, { status: 500 });
  }
}
