import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe, PLANS } from "@/lib/stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  const stripe = getStripe();

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("No userId in session metadata");
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionStatus: "active",
    },
  });

  console.log(`Checkout completed for user ${userId}, customer: ${customerId}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;
  const status = subscription.status;

  let mappedStatus: string | null = null;
  if (status === "active") mappedStatus = "active";
  else if (status === "trialing") mappedStatus = "trialing";
  else if (status === "past_due") mappedStatus = "past_due";
  else if (status === "canceled") mappedStatus = "canceled";
  else if (status === "unpaid") mappedStatus = "unpaid";

  if (!mappedStatus) {
    console.log(`Unknown subscription status: ${status}`);
    return;
  }

  await prisma.user.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: {
      stripeSubscriptionStatus: mappedStatus,
    },
  });

  console.log(`Subscription ${subscriptionId} updated to ${mappedStatus}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;

  await prisma.user.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: {
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: null,
    },
  });

  console.log(`Subscription ${subscriptionId} deleted, reset to free`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;
  const amountPaid = invoice.amount_paid;
  const currency = invoice.currency;

  console.log(`Invoice ${invoice.id} paid successfully: ${amountPaid / 100} ${currency}`);

  // Log the payment for audit
  if (customerId) {
    await prisma.user
      .findFirst({
        where: { stripeCustomerId: customerId },
        select: { id: true },
      })
      .then((user) => {
        if (user) {
          console.log(`Payment logged for user ${user.id}: ${amountPaid / 100} ${currency}`);
        }
      });
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeSubscriptionStatus: "past_due" },
    });
    console.log(`Payment failed for user ${user.id}`);
  }
}
