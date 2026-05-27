import { Skeleton } from "@socialcreator/ui/skeleton";

export default function MainLoading() {
  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-card border border-hairline rounded-xl p-6">
            <Skeleton className="w-10 h-10 rounded-lg mb-4" />
            <Skeleton className="h-3 w-24 mb-1" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
