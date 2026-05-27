import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/entitlements/stripe-webhook";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const result = await handleStripeWebhook(body, signature);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ received: true });
}
