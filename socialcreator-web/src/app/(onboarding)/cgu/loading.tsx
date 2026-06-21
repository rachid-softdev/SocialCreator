import { Skeleton } from "@socialcreator/ui/skeleton";

export default function CGULoading() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8 space-y-2">
          <Skeleton className="h-10 w-56 mx-auto" />
          <Skeleton className="h-5 w-72 mx-auto" />
        </div>
        <div className="bg-surface-card border border-hairline-strong rounded-xl p-6 space-y-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-10 w-40 rounded-pill" />
        </div>
      </div>
    </div>
  );
}
