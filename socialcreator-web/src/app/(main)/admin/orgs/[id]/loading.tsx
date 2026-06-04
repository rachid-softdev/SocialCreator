import { Skeleton } from "@socialcreator/ui/skeleton";

export default function AdminOrgDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-9 w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Skeleton className="h-48 rounded-lg" />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
