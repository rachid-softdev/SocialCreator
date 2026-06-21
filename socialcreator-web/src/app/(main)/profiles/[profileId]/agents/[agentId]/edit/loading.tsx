import { Skeleton } from "@socialcreator/ui/skeleton";

export default function EditAgentLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="bg-surface-card border border-hairline rounded-xl p-6 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-24 rounded-pill" />
          <Skeleton className="h-10 w-24 rounded-pill" />
        </div>
      </div>
    </div>
  );
}
