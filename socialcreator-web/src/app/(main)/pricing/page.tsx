import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PricingTable } from "@/components/billing/pricing-table"
import { GradientOrb } from "@socialcreator/ui/gradient-orb"

export default async function PricingPage() {
  const session = await auth()

  const faqs = [
    {
      question: "Can I change plans later?",
      answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately and will be prorated.",
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards through Stripe. Enterprise customers can also pay via invoice.",
    },
    {
      question: "Can I add more profiles later?",
      answer: "Yes, you can add additional profile slots at $20/month each from your billing settings.",
    },
    {
      question: "What happens if I exceed my profile limit?",
      answer: "You'll need to upgrade your plan to add more profiles. Existing profiles will continue to work.",
    },
    {
      question: "Is there a free trial?",
      answer: "Yes! New accounts start with 1 free profile. No credit card required to get started.",
    },
  ]

  return (
    <div className="relative min-h-screen">
      {/* Background orb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none">
        <GradientOrb color="mint" className="opacity-30" />
      </div>

      <div className="relative max-w-content mx-auto px-6 py-section">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-display-md mb-4">Simple, transparent pricing</h1>
          <p className="text-body-lg text-muted max-w-2xl mx-auto">
            Start free, upgrade when you&apos;re ready. No hidden fees, no surprises.
          </p>
        </div>

        {/* Pricing table */}
        <div className="mb-16">
          <PricingTable />
        </div>

        {/* Features comparison */}
        <div className="mb-16">
          <h2 className="text-title-md text-center mb-8">
            Everything you need to scale
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-hairline bg-surface-card p-6">
              <h3 className="text-title-sm mb-3">Multiple profiles</h3>
              <p className="text-body-sm text-muted">
                Manage multiple brands or clients from a single account with separate analytics.
              </p>
            </div>

            <div className="rounded-xl border border-hairline bg-surface-card p-6">
              <h3 className="text-title-sm mb-3">AI-powered agents</h3>
              <p className="text-body-sm text-muted">
                Automate content creation with intelligent agents that learn your brand voice.
              </p>
            </div>

            <div className="rounded-xl border border-hairline bg-surface-card p-6">
              <h3 className="text-title-sm mb-3">Advanced analytics</h3>
              <p className="text-body-sm text-muted">
                Track performance across all platforms with detailed insights and engagement metrics.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-title-md text-center mb-8">
            Frequently asked questions
          </h2>

          <div className="max-w-2xl mx-auto space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-hairline bg-surface-card overflow-hidden"
              >
                <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-strong transition-colors">
                  <span className="text-body-sm font-medium">{faq.question}</span>
                  <span className="w-5 h-5 text-muted group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <div className="px-4 pb-4 text-body-sm text-muted">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <p className="text-body-sm text-muted mb-4">
            Still have questions?
          </p>
          <a
            href="mailto:support@socialcreator.com"
            className="text-body-sm text-primary hover:underline"
          >
            Contact us →
          </a>
        </div>
      </div>
    </div>
  )
}