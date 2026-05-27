import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlanData, getInvoices, type PlanKey } from "@/lib/stripe";
import { ClientBillingPage } from "./client-billing-page";

export default async function BillingSettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch user with subscription data
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      stripeSubscriptionStatus: true,
    },
  });

  // Determine current plan
  let currentPlan: PlanKey = "free";

  if (
    user?.stripeSubscriptionStatus === "active" ||
    user?.stripeSubscriptionStatus === "trialing"
  ) {
    currentPlan = "starter"; // Default for subscribers
  }

  const planData = getPlanData(currentPlan);

  // Get invoices if customer
  const invoices = user?.stripeCustomerId ? await getInvoices(user.stripeCustomerId) : [];

  // Count profiles
  const profileCount = await prisma.profile.count({
    where: { userId: session.user.id },
  });

  // Calculate renewal date (mock - would come from Stripe)
  const renewalDate = new Date();
  renewalDate.setMonth(renewalDate.getMonth() + 1);

  return (
    <ClientBillingPage
      currentPlan={currentPlan}
      status={user?.stripeSubscriptionStatus}
      renewalDate={renewalDate}
      profileCount={profileCount}
      planData={planData}
      invoices={invoices}
    />
  );
}
