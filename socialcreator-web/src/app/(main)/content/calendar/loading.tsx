import { Skeleton } from "@socialcreator/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-pill" />
          <Skeleton className="h-8 w-20 rounded-pill" />
        </div>
      </div>
      <div className="border border-hairline rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-hairline">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-8 rounded-none" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="grid grid-cols-7">
            {Array.from({ length: 7 }).map((_, col) => (
              <Skeleton
                key={col}
                className="h-24 rounded-none border-r border-b border-hairline-soft"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
