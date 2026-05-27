import { Skeleton } from "@socialcreator/ui/skeleton";

export default function ContentLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-8 w-16 rounded-pill" />
        <Skeleton className="h-8 w-20 rounded-pill" />
        <Skeleton className="h-8 w-24 rounded-pill" />
        <Skeleton className="h-8 w-24 rounded-pill" />
        <Skeleton className="h-8 w-20 rounded-pill" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
