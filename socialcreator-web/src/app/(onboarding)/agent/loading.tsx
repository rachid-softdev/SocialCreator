import { Skeleton } from "@socialcreator/ui/skeleton";

export default function OnboardingAgentLoading() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8 space-y-2">
          <Skeleton className="h-10 w-48 mx-auto" />
          <Skeleton className="h-5 w-72 mx-auto" />
        </div>
        <div className="bg-surface-card border border-hairline-strong rounded-xl p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-pill" />
        </div>
      </div>
    </div>
  );
}
