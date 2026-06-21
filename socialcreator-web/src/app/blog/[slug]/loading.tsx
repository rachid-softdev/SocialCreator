import { Skeleton } from "@socialcreator/ui/skeleton";

export default function BlogPostLoading() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-surface-card border-b border-hairline">
        <div className="max-w-content mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex items-center gap-6">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-9 w-44 rounded-pill" />
          </div>
        </div>
      </header>
      <Skeleton className="w-full h-64 md:h-80 lg:h-96" />
      <main className="max-w-content mx-auto px-6 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-8 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-5 w-64" />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
          <aside className="lg:col-span-4">
            <Skeleton className="h-48 rounded-xl sticky top-24" />
          </aside>
        </div>
      </main>
    </div>
  );
}
