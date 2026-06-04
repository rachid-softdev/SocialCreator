import { Skeleton } from "@socialcreator/ui/skeleton";

export default function AdminLoading() {
  return (
    <div>
      <Skeleton className="h-5 w-48 mb-6" />
      <Skeleton className="h-9 w-64 mb-2" />
      <Skeleton className="h-5 w-48 mb-8" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-hairline bg-surface-card p-5">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
