import { Skeleton } from "@socialcreator/ui/skeleton";

export default function AllVideosLoading() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="border-b border-hairline bg-surface-card">
        <div className="max-w-7xl mx-auto px-6 py-4 space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-4 w-48 mt-1" />
            </div>
            <Skeleton className="h-10 w-28 rounded-pill" />
          </div>
        </div>
      </div>
      <div className="border-b border-hairline bg-surface-soft">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-pill" />
            <Skeleton className="h-8 w-24 rounded-pill" />
            <Skeleton className="h-8 w-24 rounded-pill" />
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video rounded-xl" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
