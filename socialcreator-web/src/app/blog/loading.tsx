import { Skeleton } from "@socialcreator/ui/skeleton";

export default function BlogLoading() {
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
      <section className="bg-surface-card border-b border-hairline">
        <div className="max-w-content mx-auto px-6 py-16 md:py-24">
          <div className="max-w-3xl space-y-4">
            <Skeleton className="h-6 w-48 rounded-pill" />
            <Skeleton className="h-14 w-full max-w-2xl" />
            <Skeleton className="h-5 w-full max-w-xl" />
          </div>
        </div>
      </section>
      <main className="max-w-content mx-auto px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  );
}
