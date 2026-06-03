"use client";

import { Badge } from "@socialcreator/ui/badge";
import { Button } from "@socialcreator/ui/button";
import { format } from "date-fns";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import logger from "@/lib/logger";
import { getPlanData, type PlanKey } from "@/lib/stripe";

interface BillingOverviewProps {
  currentPlan: PlanKey | null;
  status: string | null;
  renewalDate: Date | null;
  customerId: string | null;
  cancelAtPeriodEnd: boolean;
  onOpenPortal: () => Promise<void>;
  onChangePlan: (plan: PlanKey) => void;
}

export function BillingOverview({
  currentPlan,
  status,
  renewalDate,
  cancelAtPeriodEnd,
  onOpenPortal,
  onChangePlan,
}: BillingOverviewProps) {
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [isChangingPlan, setIsChangingPlan] = useState(false);

  const planData = getPlanData(currentPlan ?? "free");

  // Free plan fallback
  const plan = planData ?? {
    name: "Free",
    price: 0,
    profiles: 1,
    addOnPrice: 0,
    addOnProfiles: 1,
    features: [],
  };

  const getStatusBadge = () => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-semantic-success/10 text-semantic-success gap-1">
            <CheckCircle className="w-3 h-3" />
            Active
          </Badge>
        );
      case "trialing":
        return (
          <Badge className="bg-blue-100 text-blue-700 gap-1">
            <CreditCard className="w-3 h-3" />
            Trial
          </Badge>
        );
      case "past_due":
        return (
          <Badge className="bg-semantic-error/10 text-semantic-error gap-1">
            <AlertCircle className="w-3 h-3" />
            Past Due
          </Badge>
        );
      case "canceled":
        return (
          <Badge className="bg-muted-soft text-muted gap-1">
            <XCircle className="w-3 h-3" />
            Canceled
          </Badge>
        );
      default:
        return <Badge className="bg-muted-soft text-muted">No Subscription</Badge>;
    }
  };

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(priceInCents / 100);
  };

  const handleOpenPortal = async () => {
    setIsLoadingPortal(true);
    try {
      await onOpenPortal();
    } catch (error) {
      logger.error({ err: error }, "Failed to open portal");
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleChangePlan = async (plan: PlanKey) => {
    setIsChangingPlan(true);
    try {
      onChangePlan(plan);
    } catch (error) {
      logger.error({ err: error }, "Failed to change plan");
    } finally {
      setIsChangingPlan(false);
    }
  };

  // Pas de subscription
  if (!currentPlan || !plan) {
    return (
      <div className="rounded-xl border border-hairline p-6 bg-surface-card">
        <h3 className="text-title-md font-medium mb-4">Subscription</h3>
        <p className="text-body-sm text-muted mb-6">
          You don&apos;t have an active subscription. Choose a plan to get started.
        </p>
        <Button onClick={() => onChangePlan("starter")}>View Plans</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan Card */}
      <div className="rounded-xl border border-hairline p-6 bg-surface-card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-title-md font-medium">Current Plan</h3>
            <p className="text-2xl font-semibold mt-1">
              {plan.name}
              <span className="text-base font-normal text-muted ml-2">/month</span>
            </p>
          </div>
          {getStatusBadge()}
        </div>

        <div className="flex items-center gap-4 text-body-sm text-muted mb-6">
          <span className="flex items-center gap-1">
            <CreditCard className="w-4 h-4" />
            {formatPrice(plan.price)}/mo
          </span>

          {renewalDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Renews {format(renewalDate, "MMM d, yyyy")}
            </span>
          )}
        </div>

        {cancelAtPeriodEnd && (
          <div className="bg-semantic-error/10 text-semantic-error rounded-lg p-3 mb-4 text-body-sm">
            Your subscription will be canceled at the end of the billing period.
          </div>
        )}

        {status === "past_due" && (
          <div className="bg-semantic-error/10 text-semantic-error rounded-lg p-3 mb-4 text-body-sm">
            Your payment is past due. Please update your payment method to continue using the
            service.
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleOpenPortal} disabled={isLoadingPortal}>
            {isLoadingPortal ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ExternalLink className="w-4 h-4 mr-2" />
            )}
            Manage Billing
          </Button>

          {currentPlan !== "team" && (
            <Button
              onClick={() => handleChangePlan(currentPlan === "starter" ? "pro" : "team")}
              disabled={isChangingPlan}
            >
              {isChangingPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Upgrade Plan
            </Button>
          )}
        </div>
      </div>

      {/* Plan Features */}
      <div className="rounded-xl border border-hairline p-6 bg-surface-card">
        <h3 className="text-title-md font-medium mb-4">Plan Features</h3>
        <ul className="space-y-2 text-body-sm">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-semantic-success" />
            {plan.profiles} profile{plan.profiles > 1 ? "s" : ""} included
          </li>
          {plan.profiles === 1 && (
            <li className="flex items-center gap-2 text-muted">
              <span className="w-4 h-4 rounded-full border border-muted-soft flex items-center justify-center text-xs">
                +
              </span>
              Additional profiles: {formatPrice(plan.addOnPrice)}/mo each
            </li>
          )}
          <li className="flex items-center gap-2 text-muted">
            <span className="w-4 h-4 rounded-full border border-muted-soft flex items-center justify-center text-xs">
              +
            </span>
            Add-on profiles: {formatPrice(plan.addOnPrice)}/mo each
          </li>
        </ul>
      </div>

      {/* Help Card */}
      <div className="rounded-xl border border-hairline-soft p-6 bg-canvas-soft">
        <h3 className="text-title-sm font-medium mb-2">Need help?</h3>
        <p className="text-body-sm text-muted mb-3">
          Contact our support team for billing questions or account issues.
        </p>
        <Button variant="outline" className="text-body-sm">
          Contact Support
        </Button>
      </div>
    </div>
  );
}

// Invoice list component
interface InvoiceListProps {
  invoices: Array<{
    id: string;
    created: number;
    amount_paid: number;
    currency: string;
    status: string;
    invoice_pdf: string;
  }>;
}

export function InvoiceList({ invoices }: InvoiceListProps) {
  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  if (invoices.length === 0) {
    return <div className="text-center py-8 text-muted">No invoices yet</div>;
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface-card overflow-hidden">
      <table className="w-full">
        <thead className="bg-canvas-soft">
          <tr>
            <th className="text-left p-4 text-caption font-medium text-muted">Date</th>
            <th className="text-left p-4 text-caption font-medium text-muted">Amount</th>
            <th className="text-left p-4 text-caption font-medium text-muted">Status</th>
            <th className="text-right p-4 text-caption font-medium text-muted">Invoice</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-t border-hairline">
              <td className="p-4 text-body-sm">
                {format(new Date(invoice.created * 1000), "MMM d, yyyy")}
              </td>
              <td className="p-4 text-body-sm font-medium">
                {formatPrice(invoice.amount_paid, invoice.currency)}
              </td>
              <td className="p-4">
                <Badge
                  className={
                    invoice.status === "paid"
                      ? "bg-semantic-success/10 text-semantic-success"
                      : "bg-muted-soft text-muted"
                  }
                >
                  {invoice.status}
                </Badge>
              </td>
              <td className="p-4 text-right">
                {invoice.invoice_pdf && (
                  <a
                    href={invoice.invoice_pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-body-sm text-primary hover:underline"
                  >
                    Download
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
