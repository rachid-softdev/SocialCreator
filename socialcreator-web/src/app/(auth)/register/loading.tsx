import { Skeleton } from "@socialcreator/ui/skeleton";

export default function RegisterLoading() {
  return (
    <div className="min-h-screen bg-canvas flex">
      <div className="hidden lg:flex lg:w-1/2 relative bg-canvas-soft overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[500px] h-[500px] rounded-full opacity-60 bg-gradient-lavender/20" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-72 mt-6" />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <Skeleton className="h-8 w-40 mx-auto" />
            <Skeleton className="h-4 w-56 mx-auto" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
            <Skeleton className="h-10 w-full rounded-pill" />
          </div>
        </div>
      </div>
    </div>
  );
}
