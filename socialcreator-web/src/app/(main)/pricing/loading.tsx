/**
 * Pricing page loading skeleton
 */
export default function PricingLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="text-center space-y-4">
        <div className="h-10 w-64 bg-surface-strong rounded mx-auto" />
        <div className="h-5 w-96 bg-surface-strong rounded mx-auto" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-96 bg-surface-strong rounded-xl" />
        ))}
      </div>
    </div>
  );
}
