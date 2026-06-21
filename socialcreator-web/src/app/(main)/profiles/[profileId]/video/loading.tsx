import { Skeleton } from "@socialcreator/ui/skeleton";

export default function ProfileVideoLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded-pill" />
        <Skeleton className="h-8 w-24 rounded-pill" />
        <Skeleton className="h-8 w-24 rounded-pill" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-video rounded-xl" />
        ))}
      </div>
    </div>
  );
}
