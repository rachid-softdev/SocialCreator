import Stripe from "stripe"
import { prisma } from "@/lib/prisma"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
})

export const PLANS = {
  starter: {
    name: "Starter",
    price: 5000, // $50 in cents
    profiles: 1,
    addOnPrice: 2000, // $20/month per additional profile
    addOnProfiles: 1,
    features: [
      "1 profile",
      "Up to 2 agents",
      "Basic analytics",
      "Email support",
    ],
  },
  pro: {
    name: "Pro",
    price: 7000, // $70
    profiles: 2,
    addOnPrice: 2000,
    addOnProfiles: 1,
    features: [
      "2 profiles",
      "Up to 5 agents",
      "Advanced analytics",
      "Priority support",
      "Custom scheduling",
    ],
  },
  team: {
    name: "Team",
    price: 11000, // $110
    profiles: 4,
    addOnPrice: 2000,
    addOnProfiles: 1,
    features: [
      "4 profiles",
      "Unlimited agents",
      "Full analytics suite",
      "Priority support",
      "Custom scheduling",
      "Team collaboration",
      "API access",
    ],
  },
} as const

export type PlanKey = keyof typeof PLANS

export interface PlanDetails {
  name: string
  price: number
  profiles: number
  addOnPrice: number
  addOnProfiles: number
  features: string[]
}

export function getPlanDetails(plan: PlanKey): PlanDetails {
  return PLANS[plan]
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: PlanKey,
  additionalProfiles: number = 0
): Promise<{ sessionId: string; url: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new Error("User not found")
  }

  const planData = PLANS[plan]
  const authUrl = process.env.AUTH_URL || "http://localhost:3000"

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: `SocialCreator ${planData.name}`,
          description: `${planData.profiles} profile${planData.profiles > 1 ? "s" : ""}, up to ${plan === "starter" ? "2" : plan === "pro" ? "5" : "unlimited"} agents`,
        },
        unit_amount: planData.price,
        recurring: {
          interval: "month" as const,
        },
      },
      quantity: 1,
    },
  ]

  if (additionalProfiles > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: `Additional Profile (+${additionalProfiles})`,
          description: `Additional profile slot${additionalProfiles > 1 ? "s" : ""}`,
        },
        unit_amount: planData.addOnPrice * additionalProfiles,
        recurring: {
          interval: "month" as const,
        },
      },
      quantity: 1,
    })
  }

  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "subscription",
    success_url: `${authUrl}/settings/billing?success=true`,
    cancel_url: `${authUrl}/pricing?canceled=true`,
    metadata: {
      userId,
      plan,
      additionalProfiles: additionalProfiles.toString(),
    },
  })

  return { sessionId: session.id, url: session.url! }
}

export async function createBillingPortal(customerId: string): Promise<string> {
  const authUrl = process.env.AUTH_URL || "http://localhost:3000"

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${authUrl}/settings/billing`,
  })

  return session.url
}

export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId)
  } catch {
    return null
  }
}

export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.cancel(subscriptionId)
}

export async function getCustomer(customerId: string): Promise<Stripe.Customer | null> {
  try {
    return await stripe.customers.retrieve(customerId) as Stripe.Customer
  } catch {
    return null
  }
}

export async function getInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  })
  return invoices.data
}