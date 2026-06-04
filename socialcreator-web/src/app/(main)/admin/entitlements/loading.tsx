import { Skeleton } from "@socialcreator/ui/skeleton";

export default function EntitlementsLoading() {
  return (
    <div>
      <Skeleton className="h-5 w-48 mb-6" />
      <Skeleton className="h-9 w-64 mb-2" />
      <Skeleton className="h-5 w-64 mb-8" />
      <div className="flex gap-1 border-b border-hairline mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton array, no reordering
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>
      <div className="border border-hairline rounded-lg overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton array, no reordering
          <div key={i} className="h-14 border-b border-hairline flex items-center px-4 gap-4">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
