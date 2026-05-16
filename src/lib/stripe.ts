import Stripe from "stripe"
import { prisma } from "@/lib/prisma"

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }
  stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia" as any,
  })
  return stripeInstance
}

export const PLANS = {
  starter: {
    name: "Starter",
    price: 5000,
    profiles: 1,
    addOnPrice: 2000,
    addOnProfiles: 1,
    features: ["1 profile", "AI content generation", "Basic scheduling", "Email support"],
  },
  pro: {
    name: "Pro",
    price: 7000,
    profiles: 2,
    addOnPrice: 2000,
    addOnProfiles: 1,
    features: ["2 profiles", "AI content generation", "Advanced scheduling", "Video clipping", "Priority support"],
  },
  team: {
    name: "Team",
    price: 11000,
    profiles: 4,
    addOnPrice: 2000,
    addOnProfiles: 1,
    features: ["4 profiles", "AI content generation", "Advanced scheduling", "Video clipping", "Team collaboration", "Dedicated support"],
  },
} as const

export type PlanKey = keyof typeof PLANS | "free"
export type PaidPlanKey = keyof typeof PLANS

export function getPlanData(plan: PlanKey) {
  if (plan === "free") return null
  return PLANS[plan]
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: PlanKey,
  additionalProfiles: number = 0
): Promise<{ sessionId: string; url: string }> {
  // Free plan doesn't need a checkout session
  if (plan === "free") {
    throw new Error("Free plan does not require checkout");
  }

  const stripe = getStripe()
  const planData = PLANS[plan as Exclude<PlanKey, "free">]

  const lineItems = [
    {
      price_data: {
        currency: "usd",
        product_data: { name: `SocialCreator ${planData.name}` },
        unit_amount: planData.price as number,
        recurring: { interval: "month" as const },
      },
      quantity: 1,
    },
  ]

  if (additionalProfiles > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: `Additional Profile (+${additionalProfiles})` },
        unit_amount: (planData.addOnPrice as number) * additionalProfiles,
        recurring: { interval: "month" as const },
      },
      quantity: 1,
    })
  }

  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "subscription",
    success_url: `${process.env.AUTH_URL || "http://localhost:3000"}/settings/billing?success=true`,
    cancel_url: `${process.env.AUTH_URL || "http://localhost:3000"}/pricing?canceled=true`,
    metadata: { userId, plan, additionalProfiles: additionalProfiles.toString() },
  })

  return { sessionId: session.id, url: session.url! }
}

export async function createBillingPortal(customerId: string): Promise<string> {
  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.AUTH_URL || "http://localhost:3000"}/settings/billing`,
  })
  return session.url
}

/**
 * Mapping des price IDs Stripe vers les plans internes
 * Ces IDs sont configurés via variables d'environnement:
 * - STRIPE_PRICE_STARTER
 * - STRIPE_PRICE_PRO
 * - STRIPE_PRICE_TEAM
 */
function getStripePriceToPlan(): Record<string, PlanKey> {
  const mapping: Record<string, PlanKey> = {}

  if (process.env.STRIPE_PRICE_STARTER) {
    mapping[process.env.STRIPE_PRICE_STARTER] = "starter"
  }
  if (process.env.STRIPE_PRICE_PRO) {
    mapping[process.env.STRIPE_PRICE_PRO] = "pro"
  }
  if (process.env.STRIPE_PRICE_TEAM) {
    mapping[process.env.STRIPE_PRICE_TEAM] = "team"
  }

  return mapping
}

// Fallback: Mapping par prix (unit_amount en cents)
function inferPlanFromPrice(unitAmount: number): PlanKey | null {
  if (unitAmount === PLANS.starter.price) return "starter"
  if (unitAmount === PLANS.pro.price) return "pro"
  if (unitAmount === PLANS.team.price) return "team"
  return null
}

export type PlanDetails = {
  plan: PlanKey | null
  status: string | null
  renewalDate: Date | null
  customerId: string | null
  cancelAtPeriodEnd: boolean
  profiles: number
  features: string[]
}

export async function getPlanDetails(userId: string): Promise<PlanDetails> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeSubscriptionId: true, stripeSubscriptionStatus: true, stripeCustomerId: true },
  })

  if (!user?.stripeSubscriptionId || !user?.stripeCustomerId) {
    return {
      plan: null,
      status: null,
      renewalDate: null,
      customerId: null,
      cancelAtPeriodEnd: false,
      profiles: 1,
      features: [],
    }
  }

  // Récupérer la subscription depuis Stripe pour avoir les détails complets
  const stripe = getStripe()
  let plan: PlanKey | null = null
  let renewalDate: Date | null = null
  let cancelAtPeriodEnd = false

  try {
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
    
    // Vérifier si la subscription va être annulée
    cancelAtPeriodEnd = subscription.cancel_at_period_end
    
    // Date de renouvellement (fin de la période actuelle)
    renewalDate = new Date(subscription.current_period_end * 1000)
    
    // Récupérer le price ID du premier item
    const priceId = subscription.items.data[0]?.price.id
    const unitAmount = subscription.items.data[0]?.price.unit_amount

    // Get mapping from env vars
    const priceToPlan = getStripePriceToPlan()

    // Essayer d'abord le mapping direct par price ID
    if (priceId && priceToPlan[priceId]) {
      plan = priceToPlan[priceId]
    } else if (unitAmount) {
      // Fallback: inferrer le plan depuis le prix
      plan = inferPlanFromPrice(unitAmount)
    }
    
    // Si encore null, utiliser le status comme indice (pas idéal mais mieux que starter hardcodé)
    if (!plan && user.stripeSubscriptionStatus === "active") {
      // Pour les abonnements actifs sans correspondance, retourne null
      // plutôt que de hardcoder "starter"
      plan = null
    }
  } catch (error) {
    console.error("Failed to fetch Stripe subscription:", error)
    // En cas d'erreur, on retourne les info de base
  }

  const planFeatures = {
    free: ["1 profile", "Basic scheduling"],
    starter: ["1 profile", "AI content generation", "Basic analytics"],
    pro: ["2 profiles", "AI content generation", "Advanced analytics", "Priority support"],
    team: ["4 profiles", "AI content generation", "Advanced analytics", "Priority support", "Team collaboration"],
  } as const satisfies Partial<Record<PlanKey, string[]>>

  return {
    plan,
    status: user.stripeSubscriptionStatus,
    renewalDate,
    customerId: user.stripeCustomerId,
    cancelAtPeriodEnd,
    profiles: plan && plan !== "free" ? (PLANS[plan as Exclude<PlanKey, "free">].profiles as number) : 1,
    features: plan && plan !== "free" ? planFeatures[plan as Exclude<PlanKey, "free">] : [],
  }
}

export async function getInvoices(userId: string): Promise<Stripe.Invoice[]> {
  const stripe = getStripe()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  })

  if (!user?.stripeCustomerId) return []

  const invoices = await stripe.invoices.list({
    customer: user.stripeCustomerId,
    limit: 10,
  })

  return invoices.data
}
