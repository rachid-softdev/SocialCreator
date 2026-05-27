/**
 * Feature Flags & Entitlements - Stripe Webhook Handler
 * Handles subscription events with idempotency, transactions, and cache invalidation
 */

import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { cacheService, getEntitlementsCacheKey } from "./cache";
import { getFeatureGateService } from "./service";
import type { SubscriptionStatus } from "./types";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  console.warn("[Entitlements] STRIPE_WEBHOOK_SECRET not set - webhook handler will not work");
}

// ============================================
// Types
// ============================================

export interface WebhookHandlerResult {
  success: boolean;
  error?: string;
  orgId?: string;
  eventType?: string;
}

// ============================================
// Webhook Handler
// ============================================

/**
 * Process incoming Stripe webhook
 * Verifies signature, checks idempotency, handles event
 */
export async function handleStripeWebhook(
  payload: string,
  signature: string,
): Promise<WebhookHandlerResult> {
  const stripe = getStripe();

  // Periodic cleanup of old idempotency records
  await maybeCleanup();

  // Verify signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, WEBHOOK_SECRET!);
  } catch (err) {
    console.error("[Entitlements] Webhook signature verification failed:", err);
    return { success: false, error: "Invalid signature" };
  }

  // Check idempotency - skip if already processed
  const alreadyProcessed = await checkIdempotency(event.id);
  if (alreadyProcessed) {
    console.log(`[Entitlements] Event ${event.id} already processed, skipping`);
    return { success: true, eventType: event.type };
  }

  // Process event
  try {
    const result = await processEvent(event);

    // Mark as processed (idempotency)
    await markEventProcessed(event.id, event.type);

    return result;
  } catch (error) {
    console.error("[Entitlements] Webhook processing failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Event Processing
// ============================================

async function processEvent(event: Stripe.Event): Promise<WebhookHandlerResult> {
  const _featureGate = getFeatureGateService();

  switch (event.type) {
    case "customer.subscription.created":
      return await handleSubscriptionCreated(event.data.object as Stripe.Subscription);

    case "customer.subscription.updated":
      return await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);

    case "customer.subscription.deleted":
      return await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);

    case "invoice.payment_succeeded":
      return await handlePaymentSucceeded(event.data.object as Stripe.Invoice);

    case "invoice.payment_failed":
      return await handlePaymentFailed(event.data.object as Stripe.Invoice);

    default:
      console.log(`[Entitlements] Unhandled event type: ${event.type}`);
      return { success: true, eventType: event.type };
  }
}

// ============================================
// Event Handlers
// ============================================

async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
): Promise<WebhookHandlerResult> {
  const customerId = subscription.customer as string;
  const _subId = subscription.id;

  // Find org by customer ID
  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!org) {
    // Try to find by legacy User table
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      console.warn(`[Entitlements] No org found for customer ${customerId}`);
      return { success: false, error: "Organization not found" };
    }

    // Create organization for user if doesn't exist
    const orgData = await prisma.organization.create({
      data: {
        name: `Org for user ${user.id}`,
        stripeCustomerId: customerId,
      },
    });

    await createOrUpdateSubscription(orgData.id, subscription);

    // Invalidate cache for the newly created org
    await cacheService.invalidate(getEntitlementsCacheKey(orgData.id));
    await cacheService.publishInvalidation(orgData.id);

    return { success: true, orgId: orgData.id, eventType: "customer.subscription.created" };
  }

  await createOrUpdateSubscription(org.id, subscription);

  // Invalidate cache
  await cacheService.invalidate(getEntitlementsCacheKey(org.id));
  await cacheService.publishInvalidation(org.id);

  return { success: true, orgId: org.id, eventType: "customer.subscription.created" };
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<WebhookHandlerResult> {
  const customerId = subscription.customer as string;
  const subId = subscription.id;

  // Find org
  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!org) {
    console.warn(`[Entitlements] No org found for customer ${customerId}`);
    return { success: false, error: "Organization not found" };
  }

  await createOrUpdateSubscription(org.id, subscription);

  // Invalidate cache
  await cacheService.invalidate(getEntitlementsCacheKey(org.id));
  await cacheService.publishInvalidation(org.id);

  console.log(`[Entitlements] Subscription ${subId} updated for org ${org.id}`);
  return { success: true, orgId: org.id, eventType: "customer.subscription.updated" };
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<WebhookHandlerResult> {
  const customerId = subscription.customer as string;

  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!org) {
    console.warn(`[Entitlements] No org found for customer ${customerId}`);
    return { success: false, error: "Organization not found" };
  }

  // Set subscription to canceled (or create free tier)
  await prisma.subscription.upsert({
    where: { orgId: org.id },
    update: {
      status: "CANCELED",
      planKey: "free",
    },
    create: {
      orgId: org.id,
      status: "CANCELED",
      planKey: "free",
    },
  });

  // Invalidate cache
  await cacheService.invalidate(getEntitlementsCacheKey(org.id));
  await cacheService.publishInvalidation(org.id);

  console.log(`[Entitlements] Subscription deleted for org ${org.id}`);
  return { success: true, orgId: org.id, eventType: "customer.subscription.deleted" };
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<WebhookHandlerResult> {
  const customerId = invoice.customer as string;
  const _subscriptionId = invoice.subscription as string;

  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!org) {
    return { success: false, error: "Organization not found" };
  }

  // Update current period dates
  const periodStart = new Date(invoice.period_start * 1000);
  const periodEnd = new Date(invoice.period_end * 1000);

  await prisma.subscription.update({
    where: { orgId: org.id },
    data: {
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      status: "ACTIVE", // Payment succeeded = active
    },
  });

  console.log(`[Entitlements] Payment succeeded for org ${org.id}`);
  return { success: true, orgId: org.id, eventType: "invoice.payment_succeeded" };
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<WebhookHandlerResult> {
  const customerId = invoice.customer as string;

  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!org) {
    return { success: false, error: "Organization not found" };
  }

  await prisma.subscription.update({
    where: { orgId: org.id },
    data: {
      status: "PAST_DUE",
    },
  });

  // Invalidate cache
  await cacheService.invalidate(getEntitlementsCacheKey(org.id));
  await cacheService.publishInvalidation(org.id);

  console.log(`[Entitlements] Payment failed for org ${org.id}`);
  return { success: true, orgId: org.id, eventType: "invoice.payment_failed" };
}

// ============================================
// Helper Functions
// ============================================

async function createOrUpdateSubscription(orgId: string, subscription: Stripe.Subscription) {
  const status = mapStripeStatus(subscription.status);
  const planKey = await inferPlanKey(subscription);
  const periodStart = new Date(subscription.current_period_start * 1000);
  const periodEnd = new Date(subscription.current_period_end * 1000);

  await prisma.subscription.upsert({
    where: { orgId },
    update: {
      planKey,
      status,
      stripeSubId: subscription.id,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    create: {
      orgId,
      planKey,
      status,
      stripeSubId: subscription.id,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "unpaid":
      return "UNPAID";
    default:
      return "ACTIVE";
  }
}

async function inferPlanKey(subscription: Stripe.Subscription): Promise<string> {
  const priceId = subscription.items.data[0]?.price.id;

  // Try to match via environment variables
  if (process.env.STRIPE_PRICE_STARTER && priceId === process.env.STRIPE_PRICE_STARTER) {
    return "starter";
  }
  if (process.env.STRIPE_PRICE_PRO && priceId === process.env.STRIPE_PRICE_PRO) {
    return "pro";
  }
  if (process.env.STRIPE_PRICE_TEAM && priceId === process.env.STRIPE_PRICE_TEAM) {
    return "team";
  }

  // Fallback: try to infer from price amount
  const unitAmount = subscription.items.data[0]?.price.unit_amount;
  if (unitAmount) {
    // These should match the Plan model values
    if (unitAmount === 5000) return "starter";
    if (unitAmount === 7000) return "pro";
    if (unitAmount === 11000) return "team";
  }

  // Default to free if can't determine
  return "free";
}

// ============================================
// Idempotency
// ============================================

async function checkIdempotency(eventId: string): Promise<boolean> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { eventId },
  });
  return !!existing;
}

async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
  await prisma.webhookEvent.create({
    data: {
      eventId,
      type: eventType,
    },
  });
}

// ============================================
// Idempotency Table Cleanup
// ============================================

let lastCleanup: number = 0;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // Once per day
const WEBHOOK_EVENT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Delete webhook event records older than 7 days to prevent table bloat.
 * Can also be invoked via a cron job (e.g., daily) for more reliable cleanup.
 */
async function cleanupOldWebhookEvents(): Promise<void> {
  const cutoff = new Date(Date.now() - WEBHOOK_EVENT_TTL_MS);
  try {
    const result = await prisma.webhookEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      console.log(`[Entitlements] Cleaned up ${result.count} old webhook event records`);
    }
    lastCleanup = Date.now();
  } catch (error) {
    console.error("[Entitlements] Failed to clean up old webhook events:", error);
  }
}

/**
 * Run cleanup if it hasn't run in the past day.
 * Called at the start of handleStripeWebhook to keep the table lean.
 */
async function maybeCleanup(): Promise<void> {
  if (Date.now() - lastCleanup > CLEANUP_INTERVAL_MS) {
    await cleanupOldWebhookEvents();
  }
}

export default handleStripeWebhook;
