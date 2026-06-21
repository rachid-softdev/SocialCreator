import { Skeleton } from "@socialcreator/ui/skeleton";

export default function GenerateContentLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="bg-surface-card border border-hairline rounded-xl p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-pill" />
      </div>
    </div>
  );
}
