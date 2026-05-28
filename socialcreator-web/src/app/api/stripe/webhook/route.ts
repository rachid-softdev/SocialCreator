import { headers } from "next/headers";
import { NextResponse } from "next/server";
import logger from "@/lib/logger";
import { handleStripeWebhook } from "@/lib/entitlements/stripe-webhook";

/** Maximum Stripe webhook payload size: 1 MB */
const MAX_WEBHOOK_BODY_SIZE = 1_000_000;

export async function POST(request: Request) {
  // Enforce body size limit to prevent memory exhaustion
  const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
  if (contentLength > MAX_WEBHOOK_BODY_SIZE) {
    logger.warn({ contentLength }, "Stripe webhook payload too large");
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch (error) {
    logger.error({ err: error }, "Failed to read Stripe webhook body");
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  if (!body) {
    return NextResponse.json({ error: "Empty request body" }, { status: 400 });
  }

  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    logger.warn("Stripe webhook missing signature header");
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const result = await handleStripeWebhook(body, signature);

  if (!result.success) {
    logger.warn({ error: result.error, eventType: result.eventType }, "Stripe webhook processing failed");
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  logger.info({ eventType: result.eventType, orgId: result.orgId }, "Stripe webhook processed successfully");
  return NextResponse.json({ received: true });
}
