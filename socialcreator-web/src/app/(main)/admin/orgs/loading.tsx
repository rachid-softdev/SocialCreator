import { Skeleton } from "@socialcreator/ui/skeleton";

export default function OrgsLoading() {
  return (
    <div>
      <Skeleton className="h-5 w-48 mb-6" />
      <Skeleton className="h-9 w-48 mb-2" />
      <Skeleton className="h-5 w-64 mb-8" />
      <Skeleton className="h-10 w-full mb-4" />
      <div className="border border-hairline rounded-lg overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton array, no reordering
          <div key={i} className="h-14 border-b border-hairline flex items-center px-4 gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
