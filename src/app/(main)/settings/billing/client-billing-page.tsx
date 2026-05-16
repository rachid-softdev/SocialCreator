"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { SubscriptionStatus } from "@/components/billing/subscription-status"
import { formatDate } from "@/lib/utils"
import { getPlanData, type PlanKey } from "@/lib/stripe"
import type Stripe from "stripe"

interface ClientBillingPageProps {
  currentPlan: PlanKey
  status?: string | null
  renewalDate: Date
  profileCount: number
  planData: Record<string, unknown> | null
  invoices: Stripe.Invoice[]
}

export function ClientBillingPage({
  currentPlan,
  status,
  renewalDate,
  profileCount,
  planData,
  invoices,
}: ClientBillingPageProps) {
  const router = useRouter()
  const [isLoadingPortal, setIsLoadingPortal] = useState(false)

  const handleManagePortal = async () => {
    setIsLoadingPortal(true)
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      })

      const data = await response.json()

      if (data.url) {
        router.push(data.url)
      } else if (data.error) {
        alert(data.error)
      }
    } catch (error) {
      console.error("Failed to open portal:", error)
      alert("Failed to open billing portal")
    } finally {
      setIsLoadingPortal(false)
    }
  }

  return (
    <div className="max-w-content mx-auto px-6 py-section">
      <h1 className="text-title-md mb-8">Billing & Subscription</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current subscription */}
        <SubscriptionStatus
          plan={currentPlan}
          status={status || undefined}
          renewalDate={renewalDate}
          profilesUsed={profileCount}
          profilesMax={getPlanData(currentPlan)?.profiles || 1}
          onManagePortal={isLoadingPortal ? undefined : handleManagePortal}
        />

        {/* Current plan details */}
        {planData && (
          <div className="rounded-xl border border-hairline bg-surface-card p-6">
            <h3 className="text-title-sm mb-4">Plan features</h3>

            <ul className="space-y-2">
              {(getPlanData(currentPlan)?.features || []).map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-body-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="border-t border-hairline mt-4 pt-4">
              <p className="text-body-sm text-muted">
                Need more?{" "}
                <a href="/pricing" className="text-primary hover:underline">
                  View all plans →
                </a>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Invoice history */}
      {invoices.length > 0 && (
        <div className="mt-8">
          <h3 className="text-title-sm mb-4">Invoice history</h3>

          <div className="rounded-xl border border-hairline overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-hairline bg-surface-strong">
                  <th className="px-4 py-3 text-left text-caption font-medium text-muted">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-caption font-medium text-muted">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-caption font-medium text-muted">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-caption font-medium text-muted">
                    Invoice
                  </th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-hairline hover:bg-surface-strong transition-colors"
                  >
                    <td className="px-4 py-3 text-body-sm">
                      {formatDate(new Date(invoice.created * 1000))}
                    </td>
                    <td className="px-4 py-3 text-body-sm">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: invoice.currency?.toUpperCase() || "USD",
                      }).format((invoice.amount_paid || 0) / 100)}
                    </td>
                    <td className="px-4 py-3 text-body-sm">
                      <span
                        className={`px-2 py-1 rounded text-caption ${
                          invoice.status === "paid"
                            ? "bg-semantic-success/10 text-semantic-success"
                            : invoice.status === "open"
                            ? "bg-gradient-peach/30 text-semantic-error"
                            : "bg-surface-strong text-muted"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={invoice.hosted_invoice_url || invoice.invoice_pdf || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-body-sm text-primary hover:underline"
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Free tier message */}
      {currentPlan === "free" && (
        <div className="mt-8 text-center p-8 rounded-xl border border-hairline bg-surface-card">
          <h3 className="text-title-sm mb-2">Start scaling today</h3>
          <p className="text-body-sm text-muted mb-4">
            Upgrade to unlock more profiles, agents, and features.
          </p>
          <a
            href="/pricing"
            className="inline-block px-4 py-2 bg-primary text-on-primary rounded-pill text-body-sm hover:bg-primary-active transition-colors"
          >
            View Plans
          </a>
        </div>
      )}
    </div>
  )
}