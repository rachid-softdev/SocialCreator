import { Skeleton } from "@socialcreator/ui/skeleton";

export default function UsersLoading() {
  return (
    <div>
      <Skeleton className="h-5 w-48 mb-6" />
      <Skeleton className="h-9 w-48 mb-2" />
      <Skeleton className="h-5 w-64 mb-8" />
      <Skeleton className="h-10 w-full mb-4" />
      <div className="border border-hairline rounded-lg overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-hairline flex items-center px-4 gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
