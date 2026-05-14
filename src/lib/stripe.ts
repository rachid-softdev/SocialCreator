import Stripe from "stripe"
import { prisma } from "@/lib/prisma"

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }
  stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-12-18.acacia",
  })
  return stripeInstance
}

export const PLANS = {
  starter: { name: "Starter", price: 5000, profiles: 1, addOnPrice: 2000, addOnProfiles: 1 },
  pro: { name: "Pro", price: 7000, profiles: 2, addOnPrice: 2000, addOnProfiles: 1 },
  team: { name: "Team", price: 11000, profiles: 4, addOnPrice: 2000, addOnProfiles: 1 },
} as const

export type PlanKey = keyof typeof PLANS

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: PlanKey,
  additionalProfiles: number = 0
): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripe()
  const planData = PLANS[plan]

  const lineItems = [
    {
      price_data: {
        currency: "usd",
        product_data: { name: `SocialCreator ${planData.name}` },
        unit_amount: planData.price,
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
        unit_amount: planData.addOnPrice * additionalProfiles,
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
 * Ces IDs doivent être configurés selon votre compte Stripe
 * Vous pouvez les trouver dans la console Stripe -> Products -> Prices
 */
const STRIPE_PRICE_TO_PLAN: Record<string, PlanKey> = {
  // À configurer avec vos vrais price IDs Stripe
  // Exemple: "price_1234567890" -> "starter"
  // Vous pouvez aussi les définir via variables d'environnement
}

// Fallback: Mapping par prix (unit_amount en cents)
function inferPlanFromPrice(unitAmount: number): PlanKey | null {
  if (unitAmount === PLANS.starter.price) return "starter"
  if (unitAmount === PLANS.pro.price) return "pro"
  if (unitAmount === PLANS.team.price) return "team"
  return null
}

export async function getPlanDetails(userId: string): Promise<{
  plan: PlanKey | null
  status: string | null
  renewalDate: Date | null
  customerId: string | null
  cancelAtPeriodEnd: boolean
}> {
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
    
    // Essayer d'abord le mapping direct par price ID
    if (priceId && STRIPE_PRICE_TO_PLAN[priceId]) {
      plan = STRIPE_PRICE_TO_PLAN[priceId]
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

  return {
    plan,
    status: user.stripeSubscriptionStatus,
    renewalDate,
    customerId: user.stripeCustomerId,
    cancelAtPeriodEnd,
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
